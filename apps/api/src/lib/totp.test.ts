import { describe, expect, it } from "vitest";
import { newTotpSecret, totpUri } from "./totp.js";

describe("totpUri", () => {
  it("labels the entry with the issuer and the account email", () => {
    const secret = newTotpSecret();

    const uri = new URL(totpUri("me@example.com", secret));

    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Travel Photo Journal:me@example.com");
    expect(uri.searchParams.get("issuer")).toBe("Travel Photo Journal");
    expect(uri.searchParams.get("secret")).toBe(secret);
  });
});
