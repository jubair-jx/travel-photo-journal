import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashToken } from "../../lib/crypto.js";
import type { MailMessage } from "../../lib/mailer.js";
import type { ErrorBody } from "../../middleware/error.js";
import { resetDatabase } from "../../test/db.js";
import { buildTestContext } from "../../test/helpers.js";

const ctx = buildTestContext();

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.mailer.clear();
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

// What a user does with the email: follow the link and take the token out of it.
function tokenFromEmail(mail: MailMessage | undefined): string {
  const match = /token=([A-Za-z0-9_-]+)/.exec(mail?.text ?? "");
  if (!match?.[1]) throw new Error("no verification link in email");
  return match[1];
}

async function registerAndGetToken(): Promise<string> {
  await request(ctx.app).post("/auth/register").send(credentials).expect(201);
  return tokenFromEmail(ctx.mailer.lastTo(credentials.email));
}

const credentials = { email: "me@example.com", password: "a-long-password" };

describe("POST /auth/register", () => {
  it("creates an account and emails a verification link", async () => {
    const res = await request(ctx.app)
      .post("/auth/register")
      .send({ ...credentials, email: "Me@Example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { email: "me@example.com" } });

    const mail = ctx.mailer.lastTo("me@example.com");
    expect(mail?.subject).toMatch(/verify/i);
    expect(mail?.text).toContain("http://localhost:3000/verify-email?token=");
  });

  it("rejects a duplicate email, whatever its letter case, with 409 EMAIL_TAKEN", async () => {
    await request(ctx.app).post("/auth/register").send(credentials).expect(201);

    const res = await request(ctx.app)
      .post("/auth/register")
      .send({ ...credentials, email: "ME@example.com" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: "EMAIL_TAKEN", message: "An account with this email already exists" },
    });
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  it("rejects a malformed email and a short password with field details", async () => {
    const res = await request(ctx.app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toMatchObject([{ path: "email" }, { path: "password" }]);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

  it("stores an argon2id hash instead of the password, and only a hash of the token", async () => {
    await request(ctx.app).post("/auth/register").send(credentials).expect(201);

    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
      include: { emailVerificationTokens: true },
    });
    const rawToken = tokenFromEmail(ctx.mailer.lastTo(credentials.email));
    const [stored] = user.emailVerificationTokens;

    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(user.passwordHash).not.toContain(credentials.password);
    expect(user.emailVerifiedAt).toBeNull();
    expect(stored?.tokenHash).toBe(hashToken(rawToken));
    expect(stored?.tokenHash).not.toBe(rawToken);
  });

  it("gives the verification token a 24 hour lifetime", async () => {
    await request(ctx.app).post("/auth/register").send(credentials).expect(201);

    const stored = await ctx.prisma.emailVerificationToken.findFirstOrThrow();
    const lifetimeMs = stored.expiresAt.getTime() - stored.createdAt.getTime();

    expect(lifetimeMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 5_000);
    expect(lifetimeMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5_000);
  });

  it("still creates the account when the email cannot be sent", async () => {
    ctx.mailer.failNext();

    const res = await request(ctx.app).post("/auth/register").send(credentials);

    expect(res.status).toBe(201);
    expect(await ctx.prisma.user.count()).toBe(1);
  });
});

describe("POST /auth/verify-email", () => {
  it("verifies the account when given the emailed token", async () => {
    const token = await registerAndGetToken();

    const res = await request(ctx.app).post("/auth/verify-email").send({ token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { verified: true } });
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  const invalidTokenResponse = {
    success: false,
    error: { code: "INVALID_TOKEN", message: "Verification link is invalid or has expired" },
  };

  it("accepts a token only once", async () => {
    const token = await registerAndGetToken();
    await request(ctx.app).post("/auth/verify-email").send({ token }).expect(200);

    const again = await request(ctx.app).post("/auth/verify-email").send({ token });

    expect(again.status).toBe(400);
    expect(again.body).toEqual(invalidTokenResponse);
  });

  it("lets exactly one of two simultaneous requests win", async () => {
    const token = await registerAndGetToken();

    const results = await Promise.all([
      request(ctx.app).post("/auth/verify-email").send({ token }),
      request(ctx.app).post("/auth/verify-email").send({ token }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("rejects a token that was never issued", async () => {
    const res = await request(ctx.app).post("/auth/verify-email").send({ token: "made-up-token" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidTokenResponse);
  });

  it("rejects an expired token and leaves the account unverified", async () => {
    const token = await registerAndGetToken();
    await ctx.prisma.emailVerificationToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(ctx.app).post("/auth/verify-email").send({ token });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidTokenResponse);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("requires a token", async () => {
    const res = await request(ctx.app).post("/auth/verify-email").send({});

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/resend-verification", () => {
  const generic = {
    success: true,
    data: {
      message:
        "If an unverified account exists for that email, a new verification link has been sent.",
    },
  };

  it("emails a fresh link and retires the old one", async () => {
    const oldToken = await registerAndGetToken();

    const res = await request(ctx.app)
      .post("/auth/resend-verification")
      .send({ email: credentials.email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(generic);
    expect(ctx.mailer.sent).toHaveLength(2);
    const newToken = tokenFromEmail(ctx.mailer.lastTo(credentials.email));
    expect(newToken).not.toBe(oldToken);

    await request(ctx.app).post("/auth/verify-email").send({ token: oldToken }).expect(400);
    await request(ctx.app).post("/auth/verify-email").send({ token: newToken }).expect(200);
  });

  it("answers identically and sends nothing for an unknown email", async () => {
    const res = await request(ctx.app)
      .post("/auth/resend-verification")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(generic);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

  it("answers identically and sends nothing for an already verified account", async () => {
    const token = await registerAndGetToken();
    await request(ctx.app).post("/auth/verify-email").send({ token }).expect(200);
    ctx.mailer.clear();

    const res = await request(ctx.app)
      .post("/auth/resend-verification")
      .send({ email: credentials.email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(generic);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

  it("does not fail the request when the email cannot be sent", async () => {
    await registerAndGetToken();
    ctx.mailer.failNext();

    const res = await request(ctx.app)
      .post("/auth/resend-verification")
      .send({ email: credentials.email });

    expect(res.status).toBe(200);
  });
});

describe("auth rate limits", () => {
  const tight = { windowMs: 60_000, limit: 1 };
  const limited = buildTestContext({
    authRateLimits: { register: tight, verifyEmail: tight, resendVerification: tight },
  });

  afterAll(async () => {
    await limited.prisma.$disconnect();
  });

  it.each([
    ["/auth/register", { email: "a@example.com", password: "a-long-password" }],
    ["/auth/verify-email", { token: "whatever" }],
    ["/auth/resend-verification", { email: "a@example.com" }],
  ])("limits %s with 429 RATE_LIMITED", async (path, body) => {
    const attempt = () => request(limited.app).post(path).send(body);

    await attempt();
    const res = await attempt();

    expect(res.status).toBe(429);
    expect((res.body as ErrorBody).error.code).toBe("RATE_LIMITED");
  });
});

describe("client identity for rate limiting", () => {
  const tight = { windowMs: 60_000, limit: 1 };
  const body = { email: "a@example.com" };

  it("ignores X-Forwarded-For unless a proxy is trusted, so it cannot be used to dodge limits", async () => {
    const direct = buildTestContext({ authRateLimits: { resendVerification: tight } });

    await request(direct.app)
      .post("/auth/resend-verification")
      .set("X-Forwarded-For", "1.1.1.1")
      .send(body);
    const res = await request(direct.app)
      .post("/auth/resend-verification")
      .set("X-Forwarded-For", "2.2.2.2")
      .send(body);

    expect(res.status).toBe(429);
    await direct.prisma.$disconnect();
  });

  it("tells clients apart by X-Forwarded-For behind a trusted proxy", async () => {
    const proxied = buildTestContext({
      config: { trustProxy: 1 },
      authRateLimits: { resendVerification: tight },
    });

    await request(proxied.app)
      .post("/auth/resend-verification")
      .set("X-Forwarded-For", "1.1.1.1")
      .send(body);
    const res = await request(proxied.app)
      .post("/auth/resend-verification")
      .set("X-Forwarded-For", "2.2.2.2")
      .send(body);

    expect(res.status).toBe(200);
    await proxied.prisma.$disconnect();
  });
});
