import type { Express } from "express";
import pino, { type Logger } from "pino";
import { createApp } from "../app.js";
import type { Config } from "../config/env.js";
import type { PrismaClient } from "../lib/prisma.js";
import type { AuthRateLimits } from "../modules/auth/auth.routes.js";
import { createTestPrisma, testDatabaseUrl } from "./db.js";
import { FakeMailer } from "./fake-mailer.js";

export const testConfig: Config = {
  nodeEnv: "test",
  port: 0,
  appUrl: "http://localhost:3000",
  logLevel: "silent",
  trustProxy: 0,
  databaseUrl: testDatabaseUrl,
  mail: { from: "Journal <no-reply@test.local>", smtp: { host: "localhost", port: 1025 } },
};

// Limits high enough that ordinary tests never trip them; the rate-limit tests pass their own.
const generousLimits: AuthRateLimits = {
  register: { windowMs: 60_000, limit: 10_000 },
  verifyEmail: { windowMs: 60_000, limit: 10_000 },
  resendVerification: { windowMs: 60_000, limit: 10_000 },
};

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  mailer: FakeMailer;
}

export interface TestContextOptions {
  config?: Partial<Config>;
  logger?: Logger;
  authRateLimits?: Partial<AuthRateLimits>;
}

export function buildTestContext(options: TestContextOptions = {}): TestContext {
  const prisma = createTestPrisma();
  const mailer = new FakeMailer();
  const app = createApp({
    config: { ...testConfig, ...options.config },
    logger: options.logger ?? pino({ level: "silent" }),
    prisma,
    mailer,
    authRateLimits: { ...generousLimits, ...options.authRateLimits },
  });
  return { app, prisma, mailer };
}

export function buildTestApp(overrides: Partial<Config> = {}): Express {
  return buildTestContext({ config: overrides }).app;
}
