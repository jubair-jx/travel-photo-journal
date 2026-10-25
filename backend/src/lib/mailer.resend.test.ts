import { describe, expect, it, vi } from "vitest";
import type { Config } from "../config/env.js";
import { createMailer, NodemailerMailer, ResendMailer } from "./mailer.js";

const message = { to: "me@example.com", subject: "Hi", text: "plain", html: "<p>rich</p>" };

function build(response: { ok: boolean; status: number }) {
  const fetchImpl = vi.fn().mockResolvedValue(response);
  const mailer = new ResendMailer({
    apiKey: "resend-key",
    from: "Travel Journal <hello@example.com>",
    fetchImpl,
  });
  return { mailer, fetchImpl };
}

describe("ResendMailer", () => {
  it("posts the message to Resend's HTTPS API with the key in a header, not the body", async () => {
    const { mailer, fetchImpl } = build({ ok: true, status: 200 });

    await mailer.send(message);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer resend-key");
    expect(init.body).not.toContain("resend-key");
    expect(JSON.parse(init.body)).toEqual({
      from: "Travel Journal <hello@example.com>",
      to: ["me@example.com"],
      subject: "Hi",
      html: "<p>rich</p>",
      text: "plain",
    });
  });

  it("fails with the status only, so a reply that echoes the message never reaches the logs", async () => {
    const { mailer } = build({ ok: false, status: 403 });

    const failure = await mailer.send(message).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Resend rejected the message (status 403)");
    expect((failure as Error).message).not.toContain("me@example.com");
  });

  it("fails instead of hanging when the network does", async () => {
    const mailer = new ResendMailer({
      apiKey: "resend-key",
      from: "hello@example.com",
      fetchImpl: vi.fn().mockRejectedValue(new Error("timeout")),
    });

    await expect(mailer.send(message)).rejects.toThrow("timeout");
  });
});

describe("createMailer", () => {
  const smtp = { host: "localhost", port: 1025 };

  it("uses Resend when an API key is configured", () => {
    const mail: Config["mail"] = { from: "a@b.co", smtp, resendApiKey: "k" };

    expect(createMailer(mail)).toBeInstanceOf(ResendMailer);
  });

  it("falls back to SMTP without one", () => {
    const mail: Config["mail"] = { from: "a@b.co", smtp };

    expect(createMailer(mail)).toBeInstanceOf(NodemailerMailer);
  });
});
