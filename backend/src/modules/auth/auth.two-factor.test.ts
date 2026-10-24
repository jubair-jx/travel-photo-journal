import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret } from "../../lib/crypto.js";
import { authenticatorCode, bearerFor } from "../../test/authenticator.js";
import type { ErrorBody } from "../../middleware/error.js";
import { resetDatabase } from "../../test/db.js";
import { createUser } from "../../test/factories.js";
import { buildTestContext, testConfig } from "../../test/helpers.js";

const ctx = buildTestContext();

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

async function startSetup(userId: string): Promise<SetupData> {
  const res = await request(ctx.app)
    .post("/auth/2fa/setup")
    .set("Authorization", await bearerFor(userId))
    .expect(200);
  return (res.body as { data: SetupData }).data;
}

async function confirm(userId: string, code: string) {
  return request(ctx.app)
    .post("/auth/2fa/verify")
    .set("Authorization", await bearerFor(userId))
    .send({ code });
}

interface SetupData {
  qrCodeDataUrl: string;
  manualKey: string;
}

describe("POST /auth/2fa/setup", () => {
  it("returns a QR code and manual key, and stores the secret encrypted but not yet enabled", async () => {
    const user = await createUser(ctx.prisma);

    const res = await request(ctx.app)
      .post("/auth/2fa/setup")
      .set("Authorization", await bearerFor(user.id));

    expect(res.status).toBe(200);
    const { data } = res.body as { success: true; data: SetupData };
    expect(data.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(data.manualKey).toMatch(/^[A-Z2-7]{16,}$/);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(false);
    expect(stored.twoFactorSecret).not.toContain(data.manualKey);
    expect(decryptSecret(stored.twoFactorSecret ?? "", testConfig.totpEncryptionKey, user.id)).toBe(
      data.manualKey,
    );
  });
});

describe("POST /auth/2fa/setup (more)", () => {
  it("requires authentication", async () => {
    const res = await request(ctx.app).post("/auth/2fa/setup");

    expect(res.status).toBe(401);
    expect((res.body as ErrorBody).error.code).toBe("UNAUTHENTICATED");
  });

  it("replaces a pending secret when run again", async () => {
    const user = await createUser(ctx.prisma);

    const first = await startSetup(user.id);
    const second = await startSetup(user.id);

    expect(second.manualKey).not.toBe(first.manualKey);
    const oldCode = await authenticatorCode(first.manualKey);
    expect((await confirm(user.id, oldCode)).status).toBe(400);
    const newCode = await authenticatorCode(second.manualKey);
    expect((await confirm(user.id, newCode)).status).toBe(200);
  });

  it("refuses to replace the secret once 2FA is on", async () => {
    const user = await createUser(ctx.prisma);
    const { manualKey } = await startSetup(user.id);
    await confirm(user.id, await authenticatorCode(manualKey));
    const before = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const res = await request(ctx.app)
      .post("/auth/2fa/setup")
      .set("Authorization", await bearerFor(user.id));

    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error.code).toBe("TWO_FACTOR_ALREADY_ENABLED");
    const after = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.twoFactorSecret).toBe(before.twoFactorSecret);
  });
});

describe("POST /auth/2fa/verify", () => {
  it("enables 2FA when the code from the authenticator is right", async () => {
    const user = await createUser(ctx.prisma);
    const { manualKey } = await startSetup(user.id);

    const res = await confirm(user.id, await authenticatorCode(manualKey));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { enabled: true } });
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(true);
  });

  it("accepts the code from the previous 30-second step (clock drift)", async () => {
    const user = await createUser(ctx.prisma);
    const { manualKey } = await startSetup(user.id);

    const res = await confirm(user.id, await authenticatorCode(manualKey, 30));

    expect(res.status).toBe(200);
  });

  it("rejects a wrong or stale code and leaves 2FA off", async () => {
    const user = await createUser(ctx.prisma);
    const { manualKey } = await startSetup(user.id);

    const res = await confirm(user.id, await authenticatorCode(manualKey, 600));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: "INVALID_TOTP_CODE", message: "That code is not valid" },
    });
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(false);
  });

  it("asks for setup first when there is no pending secret", async () => {
    const user = await createUser(ctx.prisma);

    const res = await confirm(user.id, "123456");

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("TWO_FACTOR_NOT_SET_UP");
  });

  it("answers 409 when 2FA is already on", async () => {
    const user = await createUser(ctx.prisma);
    const { manualKey } = await startSetup(user.id);
    const code = await authenticatorCode(manualKey);
    expect((await confirm(user.id, code)).status).toBe(200);

    const again = await confirm(user.id, code);

    expect(again.status).toBe(409);
  });

  it.each(["12345", "1234567", "abcdef", ""])("rejects the malformed code %j", async (code) => {
    const user = await createUser(ctx.prisma);
    await startSetup(user.id);

    const res = await confirm(user.id, code);

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).post("/auth/2fa/verify").send({ code: "123456" });

    expect(res.status).toBe(401);
  });
});

describe("2FA rate limit", () => {
  const limited = buildTestContext({
    authRateLimits: { twoFactor: { windowMs: 60_000, limit: 1 } },
  });

  afterAll(async () => {
    await limited.prisma.$disconnect();
  });

  it.each(["/auth/2fa/setup", "/auth/2fa/verify"])("limits %s with 429", async (path) => {
    const attempt = () => request(limited.app).post(path);

    await attempt();
    const res = await attempt();

    expect(res.status).toBe(429);
  });
});
