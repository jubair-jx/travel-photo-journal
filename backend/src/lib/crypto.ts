import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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

const CIPHER = "aes-256-gcm";
const FORMAT_VERSION = "v1";

// Output: v1.<iv>.<auth tag>.<ciphertext>, each part base64url. The user id is bound in as
// additional authenticated data, so a value copied to another row no longer decrypts.
export function encryptSecret(plaintext: string, key: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, key, iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [FORMAT_VERSION, iv, cipher.getAuthTag(), data].map(toPart).join(".");
}

export function decryptSecret(sealed: string, key: Buffer, aad: string): string {
  const [version, iv, tag, data, ...extra] = sealed.split(".");
  if (version !== FORMAT_VERSION || !iv || !tag || !data || extra.length > 0) {
    throw new Error("unrecognised encrypted value");
  }
  const decipher = createDecipheriv(CIPHER, key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function toPart(part: Buffer | string): string {
  return Buffer.isBuffer(part) ? part.toString("base64url") : part;
}
