import { z } from "zod";

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  appUrl: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy: number;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  // Reduced to its origin: CORS compares exact strings, so a trailing slash would break it.
  APP_URL: z.url().transform((value) => new URL(value).origin),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Number of reverse proxies in front of the API; needed for correct client IPs in rate limiting.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Names and reasons only: the offending values may be secrets.
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid environment configuration:\n${lines.join("\n")}`);
  }

  const { data } = result;
  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    appUrl: data.APP_URL,
    logLevel: data.LOG_LEVEL,
    trustProxy: data.TRUST_PROXY,
  };
}
