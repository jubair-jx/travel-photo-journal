import type { MailMessage } from "../../lib/mailer.js";

export function buildVerificationEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Verify your email for Travel Photo Journal",
    text: `Welcome to Travel Photo Journal.\n\nConfirm your email address to activate your account:\n${link}\n\nThe link works once and expires in 24 hours. If you did not create an account, ignore this email.`,
    html: `<p>Welcome to Travel Photo Journal.</p><p><a href="${link}">Confirm your email address</a> to activate your account.</p><p>The link works once and expires in 24 hours. If you did not create an account, ignore this email.</p>`,
  };
}
