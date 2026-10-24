import { describe, expect, it } from "vitest";
import { generateToken, hashPassword, hashToken, verifyPassword } from "./crypto.js";

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
