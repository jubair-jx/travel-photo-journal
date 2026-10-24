import type { Express } from "express";
import pino from "pino";
import { createApp } from "../app.js";
import type { Config } from "../config/env.js";

export const testConfig: Config = {
  nodeEnv: "test",
  port: 0,
  appUrl: "http://localhost:3000",
  logLevel: "silent",
  trustProxy: 0,
};

export function buildTestApp(overrides: Partial<Config> = {}): Express {
  const config = { ...testConfig, ...overrides };
  return createApp({ config, logger: pino({ level: "silent" }) });
}
