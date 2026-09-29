import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { maskEmail } from "../../shared/logging/redact";
import type { EmailMessage, EmailProvider } from "./providers";

/**
 * Used when RESEND_API_KEY isn't set (local dev, tests). Records that an
 * email would have been sent — masked recipient and subject only. The body
 * (which may contain a verification link) is never logged.
 */
export class LogEmailAdapter implements EmailProvider {
  readonly name = "log";
  private readonly logger = new Logger("Email(dev)");
  /** Tests can read what was "sent". */
  readonly outbox: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    this.outbox.push(message);
    this.logger.log(`Not sent (no RESEND_API_KEY): "${message.subject}" → ${maskEmail(message.to)}`);
    return { providerMessageId: `dev_${randomUUID()}` };
  }
}
