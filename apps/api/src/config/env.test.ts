import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

const required = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_SECRET: "a-secret-that-is-comfortably-over-32-chars",
  // 32 bytes, base64
  TOTP_ENC_KEY: Buffer.alloc(32, 7).toString("base64"),
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
      jwt: {
        secret: required.JWT_SECRET,
        issuer: "travel-photo-journal",
        audience: "travel-photo-journal-web",
      },
      refreshCookiePath: "/",
      totpEncryptionKey: Buffer.alloc(32, 7),
      storage: {
        driver: "local",
        directory: "./uploads",
        publicBaseUrl: "http://localhost:4000",
        urlTtlSeconds: 900,
      },
      summary: {
        models: [],
        baseUrl: "https://openrouter.ai/api/v1",
        deadlineMs: 8000,
      },
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
      JWT_ISSUER: "my-issuer",
      JWT_AUDIENCE: "my-audience",
      REFRESH_COOKIE_PATH: "/api/auth",
    });

    expect(config).toMatchObject({
      jwt: { issuer: "my-issuer", audience: "my-audience" },
      refreshCookiePath: "/api/auth",
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

  it("reads R2 and summary settings, splitting the fallback model list", () => {
    const config = loadConfig({
      ...required,
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key-id",
      R2_SECRET_ACCESS_KEY: "key-secret",
      R2_BUCKET: "photos",
      SIGNED_URL_TTL_SECONDS: "300",
      OPENROUTER_API_KEY: "or-key",
      OPENROUTER_MODEL: "vendor/main:free",
      OPENROUTER_FALLBACK_MODELS: " vendor/b:free , vendor/c:free ,",
    });

    expect(config.storage).toEqual({
      driver: "r2",
      accountId: "acct",
      accessKeyId: "key-id",
      secretAccessKey: "key-secret",
      bucket: "photos",
      urlTtlSeconds: 300,
    });
    expect(config.summary).toMatchObject({
      apiKey: "or-key",
      models: ["vendor/main:free", "vendor/b:free", "vendor/c:free"],
    });
  });

  it("builds file links from API_PUBLIC_URL when given", () => {
    const config = loadConfig({ ...required, API_PUBLIC_URL: "https://app.example.com/api/" });

    expect(config.storage).toMatchObject({
      driver: "local",
      publicBaseUrl: "https://app.example.com/api",
    });
  });

  it("will not select R2 without its credentials", () => {
    const attempt = () => loadConfig({ ...required, STORAGE_DRIVER: "r2", R2_BUCKET: "photos" });

    expect(attempt).toThrow(/R2_ACCOUNT_ID/);
    expect(attempt).toThrow(/R2_SECRET_ACCESS_KEY/);
    expect(attempt).not.toThrow(/R2_BUCKET/);
  });

  it("rejects a short JWT secret without echoing it", () => {
    const attempt = () => loadConfig({ ...required, JWT_SECRET: "too-short-s3cr3t" });

    expect(attempt).toThrow(/JWT_SECRET/);
    expect(attempt).not.toThrow(/s3cr3t/);
  });

  it.each([
    ["too short", Buffer.alloc(16, 1).toString("base64")],
    ["not base64 at all", "s3cr3t-key-!!!"],
  ])("rejects a TOTP key that is %s without echoing it", (_label, key) => {
    const attempt = () => loadConfig({ ...required, TOTP_ENC_KEY: key });

    expect(attempt).toThrow(/TOTP_ENC_KEY/);
    expect(attempt).not.toThrow(new RegExp(key.slice(0, 8)));
  });

  it("requires APP_URL and DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/APP_URL/);
    expect(() => loadConfig({ APP_URL: "http://localhost:3000" })).toThrow(/DATABASE_URL/);
  });

  it("refuses to run in production against the local mail defaults", () => {
    expect(() => loadConfig({ ...required, NODE_ENV: "production" })).toThrow(/SMTP_HOST/);
  });
});
