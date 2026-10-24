import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";
import { NodemailerMailer } from "./mailer.js";

describe("NodemailerMailer", () => {
  it("sends the message from the configured sender", async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, "sendMail");
    const mailer = new NodemailerMailer(transport, "Journal <hello@example.com>");

    await mailer.send({ to: "me@example.com", subject: "Hi", text: "plain", html: "<p>rich</p>" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "Journal <hello@example.com>",
      to: "me@example.com",
      subject: "Hi",
      text: "plain",
      html: "<p>rich</p>",
    });
  });
});
