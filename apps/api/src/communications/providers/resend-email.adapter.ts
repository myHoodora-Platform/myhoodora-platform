import { Logger } from "@nestjs/common";
import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./providers";

/** The only file that knows about the Resend SDK. */
export class ResendEmailAdapter implements EmailProvider {
  readonly name = "resend";
  private readonly client: Resend;
  private readonly logger = new Logger(ResendEmailAdapter.name);

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly replyTo?: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    const { data, error } = await this.client.emails.send(
      {
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: this.replyTo,
        tags: message.tags,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (error || !data) {
      // Error objects carry name/message only — no key, no recipient body.
      this.logger.warn(`Resend rejected a message: ${error?.name ?? "unknown"}`);
      throw new Error(`resend:${error?.name ?? "unknown"}`);
    }
    return { providerMessageId: data.id };
  }
}
