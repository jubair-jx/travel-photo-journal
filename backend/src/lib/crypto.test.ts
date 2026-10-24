import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptSecret,
  encryptSecret,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./crypto.js";

describe("password hashing", () => {
  it("produces a salted argon2id hash that verifies only the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    const again = await hashPassword("correct horse battery");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toBe(again);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("treats a malformed stored hash as a failed match instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("opaque tokens", () => {
  it("generates unguessable url-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();

    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("hashes deterministically to a value that does not contain the token", () => {
    const token = generateToken();
    const hash = hashToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
    expect(hashToken(generateToken())).not.toBe(hash);
  });
});

describe("secret encryption", () => {
  const key = randomBytes(32);
  const plaintext = "JBSWY3DPEHPK3PXP";

  it("round-trips, and never stores the plaintext", () => {
    const sealed = encryptSecret(plaintext, key, "user-1");

    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain(plaintext);
    expect(decryptSecret(sealed, key, "user-1")).toBe(plaintext);
  });

  it("uses a fresh nonce each time", () => {
    expect(encryptSecret(plaintext, key, "user-1")).not.toBe(
      encryptSecret(plaintext, key, "user-1"),
    );
  });

  it("refuses to decrypt for another user, with another key, or after tampering", () => {
    const sealed = encryptSecret(plaintext, key, "user-1");
    const [version, iv, tag, data] = sealed.split(".") as [string, string, string, string];
    const flipped = Buffer.from(data, "base64url");
    flipped[0] = (flipped[0] ?? 0) ^ 1;

    expect(() => decryptSecret(sealed, key, "user-2")).toThrow();
    expect(() => decryptSecret(sealed, randomBytes(32), "user-1")).toThrow();
    expect(() =>
      decryptSecret([version, iv, tag, flipped.toString("base64url")].join("."), key, "user-1"),
    ).toThrow();
    expect(() => decryptSecret("v1.garbage", key, "user-1")).toThrow();
    expect(() => decryptSecret(sealed.replace("v1.", "v9."), key, "user-1")).toThrow();
  });
});
