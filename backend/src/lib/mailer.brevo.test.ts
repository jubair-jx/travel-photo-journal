import { describe, expect, it, vi } from "vitest";
import { BrevoMailer, createMailer, NodemailerMailer, parseSender } from "./mailer.js";
import type { Config } from "../config/env.js";

const message = { to: "me@example.com", subject: "Hi", text: "plain", html: "<p>rich</p>" };

function build(response: { ok: boolean; status: number }) {
  const fetchImpl = vi.fn().mockResolvedValue(response);
  const mailer = new BrevoMailer({
    apiKey: "brevo-key",
    from: "Travel Journal <hello@example.com>",
    fetchImpl,
  });
  return { mailer, fetchImpl };
}

describe("parseSender", () => {
  it.each([
    ["Travel Journal <hello@example.com>", { name: "Travel Journal", email: "hello@example.com" }],
    [
      '"Travel Journal" <hello@example.com>',
      { name: "Travel Journal", email: "hello@example.com" },
    ],
    ["<hello@example.com>", { email: "hello@example.com" }],
    ["hello@example.com", { email: "hello@example.com" }],
  ])("reads %s", (from, expected) => {
    expect(parseSender(from)).toEqual(expected);
  });
});

describe("BrevoMailer", () => {
  it("posts the message to Brevo's HTTPS API with the key in a header, not the body", async () => {
    const { mailer, fetchImpl } = build({ ok: true, status: 201 });

    await mailer.send(message);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("brevo-key");
    expect(init.body).not.toContain("brevo-key");
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: "Travel Journal", email: "hello@example.com" },
      to: [{ email: "me@example.com" }],
      subject: "Hi",
      htmlContent: "<p>rich</p>",
      textContent: "plain",
    });
  });

  it("fails with the status only, so a reply that echoes the message never reaches the logs", async () => {
    const { mailer } = build({ ok: false, status: 401 });

    const failure = await mailer.send(message).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Brevo rejected the message (status 401)");
    expect((failure as Error).message).not.toContain("me@example.com");
  });

  it("fails instead of hanging when the network does", async () => {
    const mailer = new BrevoMailer({
      apiKey: "brevo-key",
      from: "hello@example.com",
      fetchImpl: vi.fn().mockRejectedValue(new Error("timeout")),
    });

    await expect(mailer.send(message)).rejects.toThrow("timeout");
  });
});

describe("createMailer", () => {
  const smtp = { host: "localhost", port: 1025 };

  it("uses Brevo when an API key is configured", () => {
    const mail: Config["mail"] = { from: "a@b.co", smtp, brevoApiKey: "k" };

    expect(createMailer(mail)).toBeInstanceOf(BrevoMailer);
  });

  it("falls back to SMTP without one", () => {
    const mail: Config["mail"] = { from: "a@b.co", smtp };

    expect(createMailer(mail)).toBeInstanceOf(NodemailerMailer);
  });
});
