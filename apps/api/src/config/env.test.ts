import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

const required = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("loadConfig", () => {
  it("returns typed config with defaults and a normalized app origin", () => {
    const config = loadConfig({ ...required, APP_URL: "https://app.example.com/" });

    expect(config).toEqual({
      nodeEnv: "development",
      port: 4000,
      appUrl: "https://app.example.com",
      logLevel: "info",
      trustProxy: 0,
      databaseUrl: required.DATABASE_URL,
      mail: {
        from: "Travel Photo Journal <no-reply@localhost>",
        smtp: { host: "localhost", port: 1025 },
      },
    });
  });

  it("reads explicit values and coerces numbers", () => {
    const config = loadConfig({
      ...required,
      NODE_ENV: "production",
      PORT: "8080",
      LOG_LEVEL: "warn",
      TRUST_PROXY: "1",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "mailer",
      SMTP_PASS: "mail-pass",
      MAIL_FROM: "Journal <hello@example.com>",
    });

    expect(config).toMatchObject({
      nodeEnv: "production",
      port: 8080,
      logLevel: "warn",
      trustProxy: 1,
      mail: {
        from: "Journal <hello@example.com>",
        smtp: { host: "smtp.example.com", port: 587, user: "mailer", pass: "mail-pass" },
      },
    });
  });

  it("fails fast naming every bad variable but never echoing its value", () => {
    const attempt = () => loadConfig({ PORT: "not-a-port-s3cr3t", APP_URL: "s3cr3t-not-a-url" });

    expect(attempt).toThrow(ConfigError);
    try {
      attempt();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("PORT");
      expect(message).toContain("APP_URL");
      expect(message).not.toContain("s3cr3t");
    }
  });

  it("requires APP_URL and DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/APP_URL/);
    expect(() => loadConfig({ APP_URL: "http://localhost:3000" })).toThrow(/DATABASE_URL/);
  });

  it("refuses to run in production against the local mail defaults", () => {
    expect(() => loadConfig({ ...required, NODE_ENV: "production" })).toThrow(/SMTP_HOST/);
  });
});
