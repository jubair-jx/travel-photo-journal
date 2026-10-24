import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createAccessTokenService } from "./jwt.js";

const settings = {
  secret: "unit-test-secret-that-is-at-least-32-chars",
  issuer: "tpj-test",
  audience: "tpj-test-web",
};
const tokens = createAccessTokenService(settings);
const key = new TextEncoder().encode(settings.secret);

// Builds a token the way an attacker or a misconfigured peer might, one claim off.
function forge(
  overrides: { alg?: "HS256" | "HS512"; iss?: string; aud?: string; exp?: string | number } = {},
  secret = key,
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: overrides.alg ?? "HS256" })
    .setSubject("user-1")
    .setIssuer(overrides.iss ?? settings.issuer)
    .setAudience(overrides.aud ?? settings.audience)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? "5m")
    .sign(secret);
}

describe("access tokens", () => {
  it("round-trips the user id and reports a 15 minute lifetime", async () => {
    const { token, expiresIn } = await tokens.sign("user-1");

    expect(expiresIn).toBe(900);
    await expect(tokens.verify(token)).resolves.toEqual({ userId: "user-1" });
  });

  it.each([
    [
      "a token signed with another secret",
      () => forge({}, new TextEncoder().encode("x".repeat(40))),
    ],
    ["an expired token", () => forge({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ["the wrong issuer", () => forge({ iss: "someone-else" })],
    ["the wrong audience", () => forge({ aud: "someone-else" })],
    ["an algorithm other than HS256, even with the right secret", () => forge({ alg: "HS512" })],
  ])("rejects %s", async (_label, make) => {
    await expect(tokens.verify(await make())).rejects.toThrow();
  });

  it("rejects an unsigned token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        iss: settings.issuer,
        aud: settings.audience,
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString("base64url");

    await expect(tokens.verify(`${header}.${payload}.`)).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(tokens.verify("not.a.jwt")).rejects.toThrow();
  });
});
