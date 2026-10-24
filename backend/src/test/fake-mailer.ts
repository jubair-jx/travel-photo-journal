import type { MailMessage, Mailer } from "../lib/mailer.js";

export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  private failures = 0;

  send(message: MailMessage): Promise<void> {
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error("smtp unavailable"));
    }
    this.sent.push(message);
    return Promise.resolve();
  }

  clear(): void {
    this.sent.length = 0;
    this.failures = 0;
  }

  failNext(count = 1): void {
    this.failures = count;
  }

  // The most recent message to an address, as a user would see it in their inbox.
  lastTo(email: string): MailMessage | undefined {
    return this.sent.findLast((message) => message.to === email);
  }
}
