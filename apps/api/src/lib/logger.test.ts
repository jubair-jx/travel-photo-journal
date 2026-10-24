import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

function capture(): { lines: string[]; stream: { write: (line: string) => void } } {
  const lines: string[] = [];
  return { lines, stream: { write: (line) => lines.push(line) } };
}

describe("logger redaction", () => {
  it("never writes secrets, at the top level or nested in request and response objects", () => {
    const { lines, stream } = capture();
    const logger = createLogger("info", stream);

    logger.info({
      password: "pw-secret",
      refreshToken: "rt-secret",
      totpCode: "123456",
      req: {
        headers: { authorization: "Bearer jwt-secret", cookie: "rt=cookie-secret" },
        body: { password: "nested-pw-secret", token: "tok-secret" },
      },
      res: { headers: { "set-cookie": ["rt=set-cookie-secret"] } },
    });

    const output = lines.join("");
    for (const secret of [
      "pw-secret",
      "rt-secret",
      "123456",
      "jwt-secret",
      "cookie-secret",
      "tok-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("[REDACTED]");
  });

  it("keeps ordinary fields readable", () => {
    const { lines, stream } = capture();

    createLogger("info", stream).info({ userId: "u-1" }, "photo created");

    expect(lines.join("")).toContain("u-1");
    expect(lines.join("")).toContain("photo created");
  });
});
