import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cookieHeader, refreshCookieFrom } from "../../test/cookies.js";
import { resetDatabase } from "../../test/db.js";
import { createUser, defaultUser } from "../../test/factories.js";
import { buildTestContext } from "../../test/helpers.js";

const ctx = buildTestContext();

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

interface Device {
  accessToken: string;
  cookie: string;
}

async function signIn(userAgent: string, credentials: object = defaultUser): Promise<Device> {
  const res = await request(ctx.app)
    .post("/auth/login")
    .set("User-Agent", userAgent)
    .send(credentials);
  const cookie = refreshCookieFrom(res)?.value;
  if (!cookie) throw new Error("login did not set a refresh cookie");
  return { accessToken: (res.body as { data: { accessToken: string } }).data.accessToken, cookie };
}

const listSessions = (device: Device) =>
  request(ctx.app)
    .get("/auth/sessions")
    .set("Authorization", `Bearer ${device.accessToken}`)
    .set("Cookie", cookieHeader(device.cookie));

interface SessionRow {
  id: string;
  userAgent: string | null;
  startedAt: string;
  lastActiveAt: string;
  current: boolean;
}

const sessionsOf = (res: request.Response) => (res.body as { data: SessionRow[] }).data;

describe("GET /auth/sessions", () => {
  it("lists the signed-in devices and marks the caller's own", async () => {
    await createUser(ctx.prisma);
    const laptop = await signIn("Laptop Browser/1.0");
    const phone = await signIn("Phone Browser/2.0");

    const res = await listSessions(laptop);

    expect(res.status).toBe(200);
    const rows = sessionsOf(res);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.current)?.userAgent).toBe("Laptop Browser/1.0");
    expect(rows.find((row) => !row.current)?.userAgent).toBe("Phone Browser/2.0");
    expect(JSON.stringify(res.body)).not.toContain(phone.cookie);
  });

  it("keeps one stable id and start time for a session across refreshes", async () => {
    await createUser(ctx.prisma);
    const device = await signIn("Laptop Browser/1.0");
    const before = sessionsOf(await listSessions(device))[0];

    const refreshed = await request(ctx.app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader(device.cookie));
    const next: Device = {
      accessToken: (refreshed.body as { data: { accessToken: string } }).data.accessToken,
      cookie: refreshCookieFrom(refreshed)?.value ?? "",
    };
    const rows = sessionsOf(await listSessions(next));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: before?.id,
      startedAt: before?.startedAt,
      userAgent: "Laptop Browser/1.0",
      current: true,
    });
  });

  it("omits revoked and expired sessions", async () => {
    await createUser(ctx.prisma);
    const live = await signIn("Live/1.0");
    await signIn("Expired/1.0");
    await ctx.prisma.refreshToken.updateMany({
      where: { userAgent: "Expired/1.0" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const rows = sessionsOf(await listSessions(live));

    expect(rows.map((row) => row.userAgent)).toEqual(["Live/1.0"]);
  });

  it("never shows another user's sessions", async () => {
    await createUser(ctx.prisma);
    const other = { email: "other@example.com", password: "Another-Passw0rd!" };
    await createUser(ctx.prisma, other);
    await signIn("Other/1.0", other);
    const mine = await signIn("Mine/1.0");

    const rows = sessionsOf(await listSessions(mine));

    expect(rows.map((row) => row.userAgent)).toEqual(["Mine/1.0"]);
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).get("/auth/sessions");

    expect(res.status).toBe(401);
  });
});

describe("DELETE /auth/sessions/:id", () => {
  it("signs out one other device and leaves the rest alone", async () => {
    await createUser(ctx.prisma);
    const laptop = await signIn("Laptop/1.0");
    const phone = await signIn("Phone/1.0");
    const phoneId = sessionsOf(await listSessions(laptop)).find((row) => !row.current)?.id;

    const res = await request(ctx.app)
      .delete(`/auth/sessions/${phoneId}`)
      .set("Authorization", `Bearer ${laptop.accessToken}`)
      .set("Cookie", cookieHeader(laptop.cookie));

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
    const phoneRefresh = await request(ctx.app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader(phone.cookie));
    expect(phoneRefresh.status).toBe(401);
    const laptopRefresh = await request(ctx.app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader(laptop.cookie));
    expect(laptopRefresh.status).toBe(200);
  });

  it("clears the cookie when the caller revokes their own session", async () => {
    await createUser(ctx.prisma);
    const laptop = await signIn("Laptop/1.0");
    const ownId = sessionsOf(await listSessions(laptop))[0]?.id;

    const res = await request(ctx.app)
      .delete(`/auth/sessions/${ownId}`)
      .set("Authorization", `Bearer ${laptop.accessToken}`)
      .set("Cookie", cookieHeader(laptop.cookie));

    expect(res.status).toBe(200);
    expect(refreshCookieFrom(res)?.value).toBe("");
  });

  it("answers 404 for another user's session, exactly like a missing one", async () => {
    await createUser(ctx.prisma);
    const other = { email: "other@example.com", password: "Another-Passw0rd!" };
    await createUser(ctx.prisma, other);
    const theirs = await signIn("Other/1.0", other);
    const theirId = sessionsOf(await listSessions(theirs))[0]?.id;
    const mine = await signIn("Mine/1.0");
    const auth = { Authorization: `Bearer ${mine.accessToken}` };

    const foreign = await request(ctx.app).delete(`/auth/sessions/${theirId}`).set(auth);
    const missing = await request(ctx.app)
      .delete("/auth/sessions/3f1c1f64-6f0e-4b50-9a43-9f4a1d2f7c11")
      .set(auth);
    const malformed = await request(ctx.app).delete("/auth/sessions/not-a-uuid").set(auth);

    for (const res of [foreign, missing, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
    }
    const stillThere = await request(ctx.app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader(theirs.cookie));
    expect(stillThere.status).toBe(200);
  });
});

describe("DELETE /auth/sessions", () => {
  it("signs the user out everywhere and clears the cookie", async () => {
    await createUser(ctx.prisma);
    const laptop = await signIn("Laptop/1.0");
    const phone = await signIn("Phone/1.0");

    const res = await request(ctx.app)
      .delete("/auth/sessions")
      .set("Authorization", `Bearer ${laptop.accessToken}`)
      .set("Cookie", cookieHeader(laptop.cookie));

    expect(res.status).toBe(200);
    expect(refreshCookieFrom(res)?.value).toBe("");
    for (const device of [laptop, phone]) {
      const refresh = await request(ctx.app)
        .post("/auth/refresh")
        .set("Cookie", cookieHeader(device.cookie));
      expect(refresh.status).toBe(401);
    }
  });

  it("does not touch other users", async () => {
    await createUser(ctx.prisma);
    const other = { email: "other@example.com", password: "Another-Passw0rd!" };
    await createUser(ctx.prisma, other);
    const theirs = await signIn("Other/1.0", other);
    const mine = await signIn("Mine/1.0");

    await request(ctx.app)
      .delete("/auth/sessions")
      .set("Authorization", `Bearer ${mine.accessToken}`);

    const refresh = await request(ctx.app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader(theirs.cookie));
    expect(refresh.status).toBe(200);
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).delete("/auth/sessions");

    expect(res.status).toBe(401);
  });
});
