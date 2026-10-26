import type { WebStorage } from "redux-persist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthPayload, Photo, PhotoPage } from "../lib/types";
import { api, READ_RETRY_DELAYS_MS } from "./api";
import { credentialsReceived, emailForgotten, emailRemembered } from "./slices";
import { REFRESH_RETRY_DELAYS_MS } from "./session";
import { makeStore, restoreSession } from "./store";

interface Call {
  route: string;
  authorization: string | null;
}
type Reply = { status: number; body: unknown };
type Handler = (callNumber: number) => Reply | Promise<Reply>;

const ok = (data: unknown, status = 200): Reply => ({ status, body: { success: true, data } });
const fail = (status: number, code: string, message = code, details?: unknown): Reply => ({
  status,
  body: { success: false, error: { code, message, ...(details ? { details } : {}) } },
});

let calls: Call[];

const originalRetryDelays = {
  read: [...READ_RETRY_DELAYS_MS],
  refresh: [...REFRESH_RETRY_DELAYS_MS],
};
beforeEach(() => {
  READ_RETRY_DELAYS_MS.splice(0, READ_RETRY_DELAYS_MS.length, 0, 0);
  REFRESH_RETRY_DELAYS_MS.splice(0, REFRESH_RETRY_DELAYS_MS.length, 0, 0);
});
afterEach(() => {
  READ_RETRY_DELAYS_MS.splice(0, READ_RETRY_DELAYS_MS.length, ...originalRetryDelays.read);
  REFRESH_RETRY_DELAYS_MS.splice(0, REFRESH_RETRY_DELAYS_MS.length, ...originalRetryDelays.refresh);
});

// Stands in for the network. Routes are "METHOD /path"; a route may inspect how many times it has
// been hit, which lets a test make the first call fail and the second succeed.
function installServer(routes: Record<string, Handler>): void {
  const counts = new Map<string, number>();
  calls = [];
  vi.stubGlobal("fetch", async (target: Request | string, init?: RequestInit) => {
    const input = target instanceof Request ? target : new Request(target, init);
    const url = new URL(input.url);
    const route = `${input.method} ${url.pathname.replace(/^\/api/, "")}`;
    calls.push({ route, authorization: input.headers.get("authorization") });
    const handler = routes[route];
    if (!handler) return new Response(JSON.stringify({}), { status: 404 });
    const n = (counts.get(route) ?? 0) + 1;
    counts.set(route, n);
    const reply = await handler(n);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  });
}

function memoryStorage(): WebStorage & { dump: () => string } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
    dump: () => [...data.values()].join("\n"),
  };
}

const user = { id: "u1", email: "me@example.com" };
const session = (token: string): AuthPayload => ({ accessToken: token, expiresIn: 900, user });

const photo: Photo = {
  id: "p1",
  name: "Lake",
  location: "Pokhara",
  description: "Calm water",
  summary: null,
  imageUrl: "https://files.test/p1.png",
  imageMime: "image/png",
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
};
const page: PhotoPage = { items: [photo], page: 1, limit: 20, total: 1, totalPages: 1 };

const signedIn = (token = "token-1") => {
  const built = makeStore(memoryStorage());
  built.store.dispatch(credentialsReceived(session(token)));
  return built;
};

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signing in", () => {
  it("keeps the access token in memory state and uses it on later requests", async () => {
    installServer({
      "POST /auth/login": () => ok(session("fresh-token")),
      "GET /photos": () => ok(page),
    });
    const { store } = makeStore(memoryStorage());

    await store.dispatch(
      api.endpoints.login.initiate({ email: "me@example.com", password: "a-long-password" }),
    );
    await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(store.getState().auth).toMatchObject({
      status: "authenticated",
      accessToken: "fresh-token",
      user,
    });
    expect(calls.find((c) => c.route === "GET /photos")?.authorization).toBe("Bearer fresh-token");
  });

  it("normalizes API errors into status, code, message and field details", async () => {
    installServer({
      "POST /auth/register": () =>
        fail(400, "VALIDATION_ERROR", "Invalid request", [{ path: "email", message: "Invalid" }]),
    });
    const { store } = makeStore(memoryStorage());

    const result = await store.dispatch(
      api.endpoints.register.initiate({ email: "x", password: "y" }),
    );

    expect(result.error).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      details: [{ path: "email", message: "Invalid" }],
    });
  });

  it("reports a network failure as a NETWORK_ERROR instead of throwing", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const { store } = makeStore(memoryStorage());

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("does not try to refresh when an auth endpoint itself answers 401", async () => {
    installServer({ "POST /auth/login": () => fail(401, "INVALID_CREDENTIALS") });
    // Signed in (say, in another tab's session) and then asking to log in again with a bad password.
    const { store } = signedIn();

    const result = await store.dispatch(
      api.endpoints.login.initiate({ email: "me@example.com", password: "nope" }),
    );

    expect(result.error).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(calls.map((c) => c.route)).toEqual(["POST /auth/login"]);
  });
});

describe("silent refresh on 401", () => {
  it("refreshes once, then retries the request with the new token", async () => {
    installServer({
      "GET /photos": (n) => (n === 1 ? fail(401, "UNAUTHENTICATED") : ok(page)),
      "POST /auth/refresh": () => ok(session("token-2")),
    });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.data).toEqual(page);
    expect(calls).toEqual([
      { route: "GET /photos", authorization: "Bearer token-1" },
      { route: "POST /auth/refresh", authorization: null },
      { route: "GET /photos", authorization: "Bearer token-2" },
    ]);
    expect(store.getState().auth.accessToken).toBe("token-2");
  });

  it("runs a single refresh when several requests fail at the same time", async () => {
    installServer({
      "GET /photos": (n) => (n <= 3 ? fail(401, "UNAUTHENTICATED") : ok(page)),
      "POST /auth/refresh": async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return ok(session("token-2"));
      },
    });
    const { store } = signedIn("token-1");

    const results = await Promise.all([
      store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }, { forceRefetch: true })),
      store.dispatch(api.endpoints.listPhotos.initiate({ page: 2 }, { forceRefetch: true })),
      store.dispatch(api.endpoints.listPhotos.initiate({ page: 3 }, { forceRefetch: true })),
    ]);

    expect(results.every((r) => r.isSuccess)).toBe(true);
    expect(calls.filter((c) => c.route === "POST /auth/refresh")).toHaveLength(1);
  });

  it("signs the user out, and does not loop, when the refresh is refused", async () => {
    installServer({
      "GET /photos": () => fail(401, "UNAUTHENTICATED"),
      "POST /auth/refresh": () => fail(401, "INVALID_REFRESH_TOKEN"),
    });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ status: 401 });
    expect(store.getState().auth).toMatchObject({
      status: "anonymous",
      accessToken: null,
      user: null,
    });
    expect(calls.map((c) => c.route)).toEqual(["GET /photos", "POST /auth/refresh"]);
  });

  it("keeps the user signed in when the refresh fails only because the server is down", async () => {
    installServer({
      "GET /photos": () => fail(401, "UNAUTHENTICATED"),
      "POST /auth/refresh": () => fail(503, "SERVICE_UNAVAILABLE"),
    });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ status: 401 });
    expect(store.getState().auth.status).toBe("unavailable");
  });

  it("does not leave a second request stuck in a retry loop if the retry also fails", async () => {
    installServer({
      "GET /photos": () => fail(401, "UNAUTHENTICATED"),
      "POST /auth/refresh": () => ok(session("token-2")),
    });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.route === "GET /photos")).toHaveLength(2);
    expect(calls.filter((c) => c.route === "POST /auth/refresh")).toHaveLength(1);
  });
});

describe("restoring a session after a page load", () => {
  it("signs in from the refresh cookie", async () => {
    installServer({ "POST /auth/refresh": () => ok(session("restored")) });
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);

    expect(store.getState().auth).toMatchObject({
      status: "authenticated",
      accessToken: "restored",
    });
  });

  it("settles as anonymous when there is no valid cookie", async () => {
    installServer({ "POST /auth/refresh": () => fail(401, "INVALID_REFRESH_TOKEN") });
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe("anonymous");
  });

  it.each([
    ["a server error", () => fail(500, "INTERNAL_ERROR")],
    ["an overloaded database (503)", () => fail(503, "SERVICE_UNAVAILABLE")],
    ["rate limiting (429)", () => fail(429, "RATE_LIMITED")],
  ])("does not sign the user out when the refresh answers with %s", async (_label, reply) => {
    installServer({ "POST /auth/refresh": reply });
    const { store } = makeStore(memoryStorage());

    const renewed = await restoreSession(store.dispatch);

    expect(renewed).toBe(false);
    expect(store.getState().auth).toMatchObject({ status: "unavailable", accessToken: null });
  });

  it("treats a non-JSON error page (a proxy that cannot reach the API) as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })),
    );
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe("unavailable");
  });

  it("treats no network at all as unavailable, not as signed out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe("unavailable");
  });

  it("keeps trying while the server wakes and signs in as soon as it answers", async () => {
    installServer({
      "POST /auth/refresh": (n) => (n < 3 ? fail(503, "SERVICE_UNAVAILABLE") : ok(session("back"))),
    });
    const { store } = makeStore(memoryStorage());

    const renewed = await restoreSession(store.dispatch);

    expect(renewed).toBe(true);
    expect(calls.filter((c) => c.route === "POST /auth/refresh")).toHaveLength(3);
    expect(store.getState().auth).toMatchObject({ status: "authenticated", accessToken: "back" });
  });

  it("gives up after the retries, shows the retry panel, and a later retry can still sign in", async () => {
    installServer({
      "POST /auth/refresh": (n) =>
        n <= 3 ? fail(503, "SERVICE_UNAVAILABLE") : ok(session("finally")),
    });
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);
    expect(store.getState().auth.status).toBe("unavailable");
    await restoreSession(store.dispatch);

    expect(store.getState().auth).toMatchObject({
      status: "authenticated",
      accessToken: "finally",
    });
  });

  it("does not retry when the server clearly refuses the cookie", async () => {
    installServer({ "POST /auth/refresh": () => fail(401, "INVALID_REFRESH_TOKEN") });
    const { store } = makeStore(memoryStorage());

    await restoreSession(store.dispatch);

    expect(calls).toHaveLength(1);
    expect(store.getState().auth.status).toBe("anonymous");
  });

  it("makes one request when called repeatedly (React strict mode runs effects twice)", async () => {
    installServer({ "POST /auth/refresh": () => ok(session("restored")) });
    const { store } = makeStore(memoryStorage());

    await Promise.all([restoreSession(store.dispatch), restoreSession(store.dispatch)]);

    expect(calls).toHaveLength(1);
  });
});

describe("when the server is waking up or answers oddly", () => {
  it("repeats a read that hit a gateway error and returns the data once it answers", async () => {
    installServer({
      "GET /photos": (n) =>
        n === 1
          ? fail(503, "SERVICE_UNAVAILABLE")
          : ok({ items: [], page: 1, limit: 12, total: 0, totalPages: 0 }),
    });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toBeUndefined();
    expect(calls.filter((c) => c.route === "GET /photos")).toHaveLength(2);
  });

  it("repeats a read that got an HTML gateway page, as a sleeping host returns", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        call += 1;
        return Promise.resolve(
          call === 1
            ? new Response("<html>Gateway Timeout</html>", { status: 504 })
            : new Response(
                JSON.stringify({
                  success: true,
                  data: { items: [], page: 1, limit: 12, total: 0, totalPages: 0 },
                }),
                { status: 200, headers: { "content-type": "application/json" } },
              ),
        );
      }),
    );
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toBeUndefined();
    expect(call).toBe(2);
  });

  it("never repeats a write, which could create a second photo", async () => {
    installServer({ "POST /photos": () => fail(503, "SERVICE_UNAVAILABLE") });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.createPhoto.initiate(new FormData()));

    expect(result.error).toMatchObject({ status: 503 });
    expect(calls.filter((c) => c.route === "POST /photos")).toHaveLength(1);
  });

  it("stops repeating a read after the configured number of retries", async () => {
    installServer({ "GET /photos": () => fail(503, "SERVICE_UNAVAILABLE") });
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ status: 503 });
    expect(calls.filter((c) => c.route === "GET /photos")).toHaveLength(3);
  });

  it.each([
    [504, "SERVICE_UNAVAILABLE", /waking up or busy/],
    [502, "SERVICE_UNAVAILABLE", /waking up or busy/],
    [413, "PAYLOAD_TOO_LARGE", /too large/],
    [429, "RATE_LIMITED", /Too many requests/],
    [500, "UNKNOWN_ERROR", /Something went wrong/],
  ])(
    "explains a bare %i from a proxy instead of a generic failure",
    async (status, code, message) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve(new Response("<html>gateway</html>", { status })),
          ),
      );
      const { store } = signedIn("token-1");

      const result = await store.dispatch(api.endpoints.createPhoto.initiate(new FormData()));

      expect(result.error).toMatchObject({ status, code });
      expect((result.error as { message: string }).message).toMatch(message);
    },
  );

  it("treats a 200 that is not the usual envelope as a failure instead of crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
          ),
        ),
    );
    const { store } = signedIn("token-1");

    const result = await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    expect(result.error).toMatchObject({ code: "UNKNOWN_ERROR" });
    expect(result.data).toBeUndefined();
  });
});

describe("signing out", () => {
  it("clears the session and the cached data even if the server call fails", async () => {
    installServer({
      "GET /photos": () => ok(page),
      "POST /auth/logout": () => fail(500, "INTERNAL_ERROR"),
    });
    const { store } = signedIn();
    await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    await store.dispatch(api.endpoints.logout.initiate());

    expect(store.getState().auth).toMatchObject({ status: "anonymous", accessToken: null });
    expect(Object.keys(store.getState().api.queries)).toEqual([]);
  });
});

describe("what gets persisted", () => {
  it("stores only the remembered email, never the token, the user or cached photos", async () => {
    installServer({ "GET /photos": () => ok(page) });
    const storage = memoryStorage();
    const { store, persistor } = makeStore(storage);
    store.dispatch(credentialsReceived(session("super-secret-token")));
    store.dispatch(emailRemembered("me@example.com"));
    await store.dispatch(api.endpoints.listPhotos.initiate({ page: 1 }));

    await persistor.flush();

    const saved = storage.dump();
    expect(saved).toContain("me@example.com");
    expect(saved).not.toContain("super-secret-token");
    expect(saved).not.toContain("accessToken");
    expect(saved).not.toContain("Calm water");
  });

  it("forgets the email when asked to", async () => {
    const storage = memoryStorage();
    const { store, persistor } = makeStore(storage);
    store.dispatch(emailRemembered("me@example.com"));
    store.dispatch(emailForgotten());

    await persistor.flush();

    expect(storage.dump()).not.toContain("me@example.com");
  });
});
