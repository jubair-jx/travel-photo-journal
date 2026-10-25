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
