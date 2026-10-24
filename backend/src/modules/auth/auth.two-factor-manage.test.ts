import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ErrorBody } from "../../middleware/error.js";
import { authenticatorCode, bearerFor } from "../../test/authenticator.js";
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

// A verified user with 2FA fully on; returns the key so tests can act as their authenticator app.
async function userWithTwoFactor() {
  const user = await createUser(ctx.prisma);
  const auth = await bearerFor(user.id);
  const setup = await request(ctx.app).post("/auth/2fa/setup").set("Authorization", auth);
  const { manualKey } = (setup.body as { data: { manualKey: string } }).data;
  await request(ctx.app)
    .post("/auth/2fa/verify")
    .set("Authorization", auth)
    .send({ code: await authenticatorCode(manualKey) })
    .expect(200);
  return { user, auth, manualKey };
}

const disable = (auth: string, body: object) =>
  request(ctx.app).post("/auth/2fa/disable").set("Authorization", auth).send(body);

describe("GET /auth/2fa", () => {
  it("reports that two-factor is on once it is confirmed", async () => {
    const { auth } = await userWithTwoFactor();

    const res = await request(ctx.app).get("/auth/2fa").set("Authorization", auth);

    expect(res.body).toEqual({ success: true, data: { enabled: true } });
  });

  it("reports off for a user who never set it up", async () => {
    const user = await createUser(ctx.prisma);

    const res = await request(ctx.app)
      .get("/auth/2fa")
      .set("Authorization", await bearerFor(user.id));

    expect(res.body).toEqual({ success: true, data: { enabled: false } });
  });

  it("stays off while setup is only pending", async () => {
    const user = await createUser(ctx.prisma);
    const auth = await bearerFor(user.id);
    await request(ctx.app).post("/auth/2fa/setup").set("Authorization", auth);

    const pending = await request(ctx.app).get("/auth/2fa").set("Authorization", auth);

    expect(pending.body).toEqual({ success: true, data: { enabled: false } });
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).get("/auth/2fa");

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/2fa/disable", () => {
  it("turns two-factor off and erases the stored secret", async () => {
    const { user, auth, manualKey } = await userWithTwoFactor();

    const res = await disable(auth, {
      password: defaultUser.password,
      code: await authenticatorCode(manualKey),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { enabled: false } });
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(false);
    expect(stored.twoFactorSecret).toBeNull();
  });

  it("lets the user sign in without a code afterwards", async () => {
    const { auth, manualKey } = await userWithTwoFactor();
    await disable(auth, {
      password: defaultUser.password,
      code: await authenticatorCode(manualKey),
    }).expect(200);

    const login = await request(ctx.app).post("/auth/login").send(defaultUser);

    expect(login.status).toBe(200);
  });

  it("refuses a wrong password and changes nothing", async () => {
    const { user, auth, manualKey } = await userWithTwoFactor();

    const res = await disable(auth, {
      password: "not-the-password",
      code: await authenticatorCode(manualKey),
    });

    expect(res.status).toBe(403);
    expect((res.body as ErrorBody).error.code).toBe("INCORRECT_PASSWORD");
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(true);
  });

  it("refuses a wrong code and changes nothing", async () => {
    const { user, auth, manualKey } = await userWithTwoFactor();

    const res = await disable(auth, {
      password: defaultUser.password,
      code: await authenticatorCode(manualKey, 300),
    });

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("INVALID_TOTP_CODE");
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(true);
  });

  it("answers 409 when two-factor is not on", async () => {
    const user = await createUser(ctx.prisma);

    const res = await disable(await bearerFor(user.id), {
      password: defaultUser.password,
      code: "123456",
    });

    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error.code).toBe("TWO_FACTOR_NOT_ENABLED");
  });

  it("validates the body and requires authentication", async () => {
    const user = await createUser(ctx.prisma);

    const invalid = await disable(await bearerFor(user.id), { password: "", code: "12" });
    const anonymous = await request(ctx.app).post("/auth/2fa/disable").send({});

    expect(invalid.status).toBe(400);
    expect(anonymous.status).toBe(401);
  });
});
