import pino, { type DestinationStream, type Logger, type LevelWithSilent } from "pino";

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "totpCode",
  "totpSecret",
  "authorization",
  "cookie",
];

// Redaction is path-based, so each key is covered at the top level and up to three levels deep
// (e.g. req.headers.authorization, req.body.password).
const REDACT_PATHS = [
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`]),
  '["set-cookie"]',
  '*["set-cookie"]',
  '*.*["set-cookie"]',
];

export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } }, destination);
}
