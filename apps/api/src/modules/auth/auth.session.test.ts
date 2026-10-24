import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashToken } from "../../lib/crypto.js";
import { createAccessTokenService } from "../../lib/jwt.js";
import type { ErrorBody } from "../../middleware/error.js";
import { cookieHeader, refreshCookieFrom } from "../../test/cookies.js";
import { resetDatabase } from "../../test/db.js";
import { createUser, defaultUser } from "../../test/factories.js";
import { buildTestContext, testConfig } from "../../test/helpers.js";

const ctx = buildTestContext();
const accessTokens = createAccessTokenService(testConfig.jwt);

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

async function signIn(): Promise<string> {
  const cookie = refreshCookieFrom(await login())?.value;
  if (!cookie) throw new Error("login did not set a refresh cookie");
  return cookie;
}

const refresh = (cookie?: string) => {
  const req = request(ctx.app).post("/auth/refresh");
  return cookie === undefined ? req : req.set("Cookie", cookieHeader(cookie));
};

const logout = (cookie?: string) => {
  const req = request(ctx.app).post("/auth/logout");
  return cookie === undefined ? req : req.set("Cookie", cookieHeader(cookie));
};

const login = (body: object = defaultUser) => request(ctx.app).post("/auth/login").send(body);

describe("POST /auth/login", () => {
  it("signs in a verified user: access token in the body, refresh token in a cookie", async () => {
    const user = await createUser(ctx.prisma);

    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        accessToken: expect.any(String) as string,
        expiresIn: 900,
        user: { id: user.id, email: user.email },
      },
    });
    const { accessToken } = (res.body as { data: { accessToken: string } }).data;
    await expect(accessTokens.verify(accessToken)).resolves.toEqual({ userId: user.id });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const cookie = refreshCookieFrom(res);
    expect(cookie?.attributes).toEqual(
      expect.arrayContaining(["HttpOnly", "SameSite=Lax", "Path=/"]),
    );
    expect(cookie?.attributes.some((a) => a === `Max-Age=${7 * 24 * 60 * 60}`)).toBe(true);
  });

  it("keeps only a hash of the refresh token", async () => {
    await createUser(ctx.prisma);

    const cookie = refreshCookieFrom(await login());

    const stored = await ctx.prisma.refreshToken.findFirstOrThrow();
    expect(stored.tokenHash).toBe(hashToken(cookie?.value ?? ""));
    expect(stored.tokenHash).not.toBe(cookie?.value);
    expect(stored.revokedAt).toBeNull();
  });

  it("marks the cookie Secure in production", async () => {
    const production = buildTestContext({ config: { nodeEnv: "production" } });
    await createUser(production.prisma);

    const res = await request(production.app).post("/auth/login").send(defaultUser);

    expect(refreshCookieFrom(res)?.attributes).toContain("Secure");
    await production.prisma.$disconnect();
  });

  it("accepts the email in any letter case, with stray spaces", async () => {
    await createUser(ctx.prisma);

    const res = await login({ email: "  Traveller@EXAMPLE.com ", password: defaultUser.password });

    expect(res.status).toBe(200);
  });

  it("gives a wrong password and an unknown email the identical 401, with no cookie", async () => {
    await createUser(ctx.prisma);

    const wrongPassword = await login({ ...defaultUser, password: "not-the-password" });
    const unknownEmail = await login({ email: "nobody@example.com", password: "whatever-else" });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
      expect(refreshCookieFrom(res)).toBeUndefined();
    }
  });

  it("takes about as long to reject an unknown email as a wrong password", async () => {
    await createUser(ctx.prisma);
    const time = async (body: object): Promise<number> => {
      const start = performance.now();
      await login(body);
      return performance.now() - start;
    };
    await time({ email: "nobody@example.com", password: "warm-up" });

    const wrong: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      wrong.push(await time({ ...defaultUser, password: "not-the-password" }));
      unknown.push(await time({ email: "nobody@example.com", password: "not-the-password" }));
    }
    const median = (values: number[]): number => values.sort((a, b) => a - b)[2] ?? 0;

    // Without the equalizing hash an unknown email returns in a few ms; with it, in tens.
    expect(median(unknown)).toBeGreaterThan(median(wrong) * 0.5);
  });

  it("refuses an unverified account only after the password is proven right", async () => {
    await createUser(ctx.prisma, { verified: false });

    const right = await login();
    const wrong = await login({ ...defaultUser, password: "not-the-password" });

    expect(right.status).toBe(403);
    expect(right.body).toEqual({
      success: false,
      error: {
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email address before signing in",
      },
    });
    expect(refreshCookieFrom(right)).toBeUndefined();
    expect(wrong.status).toBe(401);
  });

  it("validates the request body", async () => {
    const res = await login({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token and clears the cookie", async () => {
    await createUser(ctx.prisma);
    const token = await signIn();

    const res = await logout(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
    expect(refreshCookieFrom(res)?.value).toBe("");
    expect((await refresh(token)).status).toBe(401);
  });

  it("only ends the session it was called for", async () => {
    await createUser(ctx.prisma);
    const laptop = await signIn();
    const phone = await signIn();

    await logout(laptop);

    expect((await refresh(phone)).status).toBe(200);
  });

  it.each([
    ["no cookie", () => logout()],
    ["an unknown token", () => logout("not-a-token-we-issued")],
  ])("still succeeds with %s, so it is safe to call twice", async (_label, attempt) => {
    const res = await attempt();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });
});

describe("login rate limit", () => {
  const limited = buildTestContext({
    authRateLimits: { login: { windowMs: 60_000, limit: 2 } },
  });

  afterAll(async () => {
    await limited.prisma.$disconnect();
  });

  it("answers 429 once the limit is exceeded", async () => {
    const attempt = () => request(limited.app).post("/auth/login").send(defaultUser);

    await attempt();
    await attempt();
    const res = await attempt();

    expect(res.status).toBe(429);
    expect((res.body as ErrorBody).error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /auth/refresh", () => {
  it("swaps the refresh token for a new pair and retires the old token", async () => {
    const user = await createUser(ctx.prisma);
    const first = await signIn();

    const res = await refresh(first);

    expect(res.status).toBe(200);
    const body = res.body as { data: { accessToken: string; expiresIn: number; user: object } };
    expect(body.data.user).toEqual({ id: user.id, email: user.email });
    expect(body.data.expiresIn).toBe(900);
    await expect(accessTokens.verify(body.data.accessToken)).resolves.toEqual({ userId: user.id });

    const second = refreshCookieFrom(res)?.value;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    const oldRow = await ctx.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(first) },
    });
    const newRow = await ctx.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(second ?? "") },
    });
    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedById).toBe(newRow.id);
    expect(newRow.revokedAt).toBeNull();
  });

  const sessionExpired = {
    success: false,
    error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired, sign in again" },
  };
  const isCleared = (res: Parameters<typeof refreshCookieFrom>[0]): boolean => {
    const cookie = refreshCookieFrom(res);
    return (
      cookie?.value === "" &&
      cookie.attributes.some((a) => a.startsWith("Expires=Thu, 01 Jan 1970"))
    );
  };

  it("keeps a session going across many rotations", async () => {
    await createUser(ctx.prisma);
    let current = await signIn();

    for (let i = 0; i < 3; i += 1) {
      const res = await refresh(current);
      expect(res.status).toBe(200);
      current = refreshCookieFrom(res)?.value ?? "";
    }
  });

  it("treats a replayed token as theft: rejects it and revokes the newer token too", async () => {
    await createUser(ctx.prisma);
    const stolen = await signIn();
    const legitimate = refreshCookieFrom(await refresh(stolen))?.value ?? "";

    const replay = await refresh(stolen);
    const afterwards = await refresh(legitimate);

    expect(replay.status).toBe(401);
    expect(replay.body).toEqual(sessionExpired);
    expect(isCleared(replay)).toBe(true);
    expect(afterwards.status).toBe(401);
  });

  it("revokes every descendant when an old token in a long chain is replayed", async () => {
    await createUser(ctx.prisma);
    const first = await signIn();
    let current = first;
    for (let i = 0; i < 3; i += 1) {
      current = refreshCookieFrom(await refresh(current))?.value ?? "";
    }

    await refresh(first);

    expect(await ctx.prisma.refreshToken.count()).toBe(4);
    expect(await ctx.prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("leaves other users and their sessions alone", async () => {
    await createUser(ctx.prisma);
    await createUser(ctx.prisma, { email: "other@example.com" });
    const mine = await signIn();
    const theirs =
      refreshCookieFrom(await login({ email: "other@example.com", password: defaultUser.password }))
        ?.value ?? "";
    await refresh(mine);

    await refresh(mine);

    expect((await refresh(theirs)).status).toBe(200);
  });

  it("lets exactly one of two simultaneous refreshes through", async () => {
    await createUser(ctx.prisma);
    const token = await signIn();

    const results = await Promise.all([refresh(token), refresh(token)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it.each([
    ["no cookie", () => refresh()],
    ["an unknown token", () => refresh("not-a-token-we-issued")],
  ])("rejects %s and clears the cookie", async (_label, attempt) => {
    const res = await attempt();

    expect(res.status).toBe(401);
    expect(res.body).toEqual(sessionExpired);
    expect(isCleared(res)).toBe(true);
  });

  it("rejects an expired token without disturbing anything else", async () => {
    await createUser(ctx.prisma);
    const token = await signIn();
    await ctx.prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await refresh(token);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(sessionExpired);
  });
});

describe("refresh and logout rate limit", () => {
  const limited = buildTestContext({
    authRateLimits: { session: { windowMs: 60_000, limit: 1 } },
  });

  afterAll(async () => {
    await limited.prisma.$disconnect();
  });

  it.each(["/auth/refresh", "/auth/logout"])("limits %s with 429", async (path) => {
    const attempt = () => request(limited.app).post(path);

    await attempt();
    const res = await attempt();

    expect(res.status).toBe(429);
  });
});
