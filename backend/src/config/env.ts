import { z } from "zod";

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  appUrl: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy: number;
  databaseUrl: string;
  jwt: { secret: string; issuer: string; audience: string };
  // Path attribute of the refresh cookie; must match the URL path the browser sees.
  refreshCookiePath: string;
  // AES-256 key protecting TOTP secrets at rest.
  totpEncryptionKey: Buffer;
  mail: {
    from: string;
    // When set, mail goes out through Brevo's HTTPS API instead of SMTP.
    brevoApiKey?: string;
    smtp: { host: string; port: number; user?: string; pass?: string };
  };
  storage: StorageConfig;
  summary: {
    apiKey?: string;
    // Primary model first, then fallbacks. Empty means summaries are off.
    models: string[];
    baseUrl: string;
    deadlineMs: number;
    // Preferred when set: Anthropic's API with the cheapest model.
    anthropic?: { apiKey: string; model: string };
  };
}

export type StorageConfig =
  | { driver: "local"; directory: string; publicBaseUrl: string; urlTtlSeconds: number }
  | {
      driver: "s3";
      endpoint: string;
      region: string;
      forcePathStyle: boolean;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      urlTtlSeconds: number;
    };

const S3_KEYS = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
] as const;

// Comma-separated list from an env var; blanks and stray commas are ignored.
const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    // Reduced to its origin: CORS compares exact strings, so a trailing slash would break it.
    APP_URL: z.url().transform((value) => new URL(value).origin),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    // Number of reverse proxies in front of the API; needed for correct client IPs in rate limiting.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    // Pooled connection string used by the running app.
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // HS256 needs a key at least as long as the hash output (256 bits).
    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1).default("travel-photo-journal"),
    JWT_AUDIENCE: z.string().min(1).default("travel-photo-journal-web"),
    REFRESH_COOKIE_PATH: z.string().startsWith("/").default("/"),
    TOTP_ENC_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Must be base64")
      .transform((value) => Buffer.from(value, "base64"))
      .refine((key) => key.length === 32, "Must decode to exactly 32 bytes"),
    BREVO_API_KEY: z.string().min(1).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).optional(),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().min(1).default("./uploads"),
    // Where browsers reach this API; local file links are built from it.
    API_PUBLIC_URL: z.url().optional(),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).default(900),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    // Neon requires path-style addressing; R2 and AWS accept it too.
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().min(1).optional(),
    OPENROUTER_FALLBACK_MODELS: z.string().optional(),
    OPENROUTER_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
  })
  .superRefine((env, ctx) => {
    // The local defaults point at a mail catcher; running production on them would silently drop mail.
    if (env.NODE_ENV === "production") {
      // With an HTTPS mail API there is no SMTP host to require.
      const required = env.BREVO_API_KEY
        ? (["MAIL_FROM"] as const)
        : (["SMTP_HOST", "MAIL_FROM"] as const);
      for (const key of required) {
        if (env[key] === undefined) {
          ctx.addIssue({ code: "custom", path: [key], message: "Required in production" });
        }
      }
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of S3_KEYS) {
        if (env[key] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: 'Required when STORAGE_DRIVER is "s3"',
          });
        }
      }
    }
  });

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  // `KEY=` in a .env file, or an unset variable passed through by Docker Compose, arrives as an
  // empty string. For every setting that means "not set", so defaults apply and optional features
  // stay off; required settings are then reported as missing.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(present);
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
    databaseUrl: data.DATABASE_URL,
    jwt: { secret: data.JWT_SECRET, issuer: data.JWT_ISSUER, audience: data.JWT_AUDIENCE },
    refreshCookiePath: data.REFRESH_COOKIE_PATH,
    totpEncryptionKey: data.TOTP_ENC_KEY,
    mail: {
      from: data.MAIL_FROM ?? "Travel Photo Journal <no-reply@localhost>",
      ...(data.BREVO_API_KEY !== undefined && { brevoApiKey: data.BREVO_API_KEY }),
      smtp: {
        host: data.SMTP_HOST ?? "localhost",
        port: data.SMTP_PORT,
        ...(data.SMTP_USER !== undefined && { user: data.SMTP_USER }),
        ...(data.SMTP_PASS !== undefined && { pass: data.SMTP_PASS }),
      },
    },
    storage: buildStorageConfig(data),
    summary: {
      ...(data.OPENROUTER_API_KEY !== undefined && { apiKey: data.OPENROUTER_API_KEY }),
      models: [
        ...(data.OPENROUTER_MODEL ? [data.OPENROUTER_MODEL] : []),
        ...splitList(data.OPENROUTER_FALLBACK_MODELS),
      ],
      baseUrl: data.OPENROUTER_BASE_URL,
      // One deadline for the whole attempt across all models (ADR-0006).
      deadlineMs: 8000,
      ...(data.ANTHROPIC_API_KEY !== undefined && {
        anthropic: { apiKey: data.ANTHROPIC_API_KEY, model: data.ANTHROPIC_MODEL },
      }),
    },
  };
}

function buildStorageConfig(data: z.output<typeof envSchema>): StorageConfig {
  if (
    data.STORAGE_DRIVER === "s3" &&
    data.S3_ENDPOINT &&
    data.S3_REGION &&
    data.S3_ACCESS_KEY_ID &&
    data.S3_SECRET_ACCESS_KEY &&
    data.S3_BUCKET
  ) {
    return {
      driver: "s3",
      endpoint: data.S3_ENDPOINT,
      region: data.S3_REGION,
      forcePathStyle: data.S3_FORCE_PATH_STYLE,
      accessKeyId: data.S3_ACCESS_KEY_ID,
      secretAccessKey: data.S3_SECRET_ACCESS_KEY,
      bucket: data.S3_BUCKET,
      urlTtlSeconds: data.SIGNED_URL_TTL_SECONDS,
    };
  }
  // A path is kept (e.g. "https://site/api" behind the web proxy), without a trailing slash.
  const base = new URL(data.API_PUBLIC_URL ?? `http://localhost:${data.PORT}`);
  return {
    driver: "local",
    directory: data.LOCAL_STORAGE_DIR,
    publicBaseUrl: `${base.origin}${base.pathname.replace(/\/+$/, "")}`,
    urlTtlSeconds: data.SIGNED_URL_TTL_SECONDS,
  };
}
