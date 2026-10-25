import nodemailer, { type Transporter } from "nodemailer";
import type { Config } from "../config/env.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class NodemailerMailer implements Mailer {
  constructor(
    private readonly transport: Transporter,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

export function createSmtpMailer({ from, smtp }: Config["mail"]): Mailer {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // Port 465 is implicit TLS; other ports (587, Mailpit's 1025) upgrade via STARTTLS when offered.
    secure: smtp.port === 465,
    // The defaults wait up to two minutes for a server that never answers.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(smtp.user !== undefined &&
      smtp.pass !== undefined && { auth: { user: smtp.user, pass: smtp.pass } }),
  });
  return new NodemailerMailer(transport, from);
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Sends over HTTPS instead of SMTP. Free hosting tiers (Render's included) block the SMTP ports, so
// an API call on port 443 is the only thing that works there. `from` must be on a domain verified
// in the Resend account; Resend accepts "Name <address>" as is.
export class ResendMailer implements Mailer {
  constructor(
    private readonly options: {
      apiKey: string;
      from: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async send(message: MailMessage): Promise<void> {
    const doFetch = this.options.fetchImpl ?? fetch;
    const response = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
    });
    // The status only: the reply can echo the recipient and message.
    if (!response.ok) throw new Error(`Resend rejected the message (status ${response.status})`);
  }
}

export function createMailer(mail: Config["mail"]): Mailer {
  if (mail.resendApiKey) return new ResendMailer({ apiKey: mail.resendApiKey, from: mail.from });
  return createSmtpMailer(mail);
}
