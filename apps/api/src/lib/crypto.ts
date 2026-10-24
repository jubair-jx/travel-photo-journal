import { createHash, randomBytes } from "node:crypto";
import argon2, { type HashOptions } from "argon2";

// OWASP's minimum argon2id profile: 19 MiB of memory, 2 passes, 1 lane.
const ARGON2_OPTIONS: HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // argon2 throws on a malformed hash; for callers that is just "does not match".
    return false;
  }
}

// 32 random bytes (256 bits), base64url so the value is safe in URLs and cookies.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Tokens are high-entropy random values, so a fast hash is enough: there is nothing to brute-force.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
