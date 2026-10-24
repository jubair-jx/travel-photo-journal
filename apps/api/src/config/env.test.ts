import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("returns typed config with defaults and a normalized app origin", () => {
    const config = loadConfig({ APP_URL: "https://app.example.com/" });

    expect(config).toEqual({
      nodeEnv: "development",
      port: 4000,
      appUrl: "https://app.example.com",
      logLevel: "info",
      trustProxy: 0,
    });
  });

  it("reads explicit values and coerces numbers", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "8080",
      APP_URL: "http://localhost:3000",
      LOG_LEVEL: "warn",
      TRUST_PROXY: "1",
    });

    expect(config).toMatchObject({
      nodeEnv: "production",
      port: 8080,
      logLevel: "warn",
      trustProxy: 1,
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

  it("requires APP_URL", () => {
    expect(() => loadConfig({})).toThrow(/APP_URL/);
  });
});
