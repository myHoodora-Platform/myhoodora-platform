import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { maskEmail } from "../shared/logging/redact";
import { EMAIL_PROVIDER, type EmailProvider } from "./providers/providers";
import { Communication, CommunicationDocument, type CommunicationStatus } from "./schemas/communication.schema";
import type { RenderedEmail } from "./templates/email-templates";

export interface SendEmailInput {
  uid?: string;
  to: string;
  /** Purpose, e.g. "welcome_verify". Stored for reporting. */
  type: string;
  email: RenderedEmail;
  /** Same key → sent at most once (ours + Resend's 24 h window). */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

/** Delivery states that can't be overwritten by a later, less final event. */
const FINAL: CommunicationStatus[] = ["bounced", "complained", "failed", "suppressed"];
const RANK: Record<CommunicationStatus, number> = {
  queued: 0,
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  bounced: 4,
  complained: 4,
  failed: 4,
  suppressed: 4,
};

const EVENT_STATUS: Record<string, CommunicationStatus | undefined> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

/**
 * External communication (email today). Business code calls sendEmail();
 * the provider behind EMAIL_PROVIDER is an adapter. Sends never throw into
 * the calling use case — a failed email must not roll back a registration.
 */
@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @InjectModel(Communication.name) private readonly comms: Model<CommunicationDocument>,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<CommunicationDocument | null> {
    let row: CommunicationDocument;
    try {
      row = await this.comms.create({
        uid: input.uid,
        channel: "email",
        type: input.type,
        provider: this.email.name,
        idempotencyKey: input.idempotencyKey,
        status: "queued",
        metadata: input.metadata,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const existing = await this.comms.findOne({ idempotencyKey: input.idempotencyKey }).exec();
        // Already sent (or in flight) → do nothing. Failed → allow a retry.
        if (existing && existing.status !== "failed") return existing;
        if (!existing) return null;
        row = existing;
      } else {
        throw err;
      }
    }

    try {
      const { providerMessageId } = await this.email.send({
        to: input.to,
        subject: input.email.subject,
        html: input.email.html,
        text: input.email.text,
        idempotencyKey: input.idempotencyKey,
        tags: [{ name: "type", value: input.type.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      });
      row.providerMessageId = providerMessageId;
      row.status = "sent";
      row.sentAt = new Date();
      row.error = undefined;
      await row.save();
    } catch (err) {
      row.status = "failed";
      row.failedAt = new Date();
      row.error = String((err as Error).message ?? "send_failed").slice(0, 80);
      await row.save();
      this.logger.warn(`Email "${input.type}" to ${maskEmail(input.to)} failed: ${row.error}`);
    }
    return row;
  }

  /**
   * Apply a verified Resend webhook event. Idempotent: the same svix-id is
   * applied once, and a status never moves backwards (e.g. "sent" arriving
   * after "delivered" is ignored).
   */
  async applyEmailEvent(eventId: string, type: string, providerMessageId: string, at: Date): Promise<"applied" | "duplicate" | "ignored" | "unknown"> {
    const status = EVENT_STATUS[type];
    if (!status) return "ignored";
    const row = await this.comms.findOne({ providerMessageId }).exec();
    if (!row) return "unknown";
    if (row.processedEventIds.includes(eventId)) return "duplicate";

    const update: Record<string, unknown> = {};
    if (!FINAL.includes(row.status) && RANK[status] >= RANK[row.status]) {
      update.status = status;
      if (status === "delivered") update.deliveredAt = at;
      if (FINAL.includes(status)) update.failedAt = at;
    }
    // Conditional update: a concurrent duplicate delivery can't apply twice.
    const res = await this.comms
      .updateOne({ _id: row._id, processedEventIds: { $ne: eventId } }, { $set: update, $push: { processedEventIds: { $each: [eventId], $slice: -50 } } })
      .exec();
    return res.modifiedCount ? "applied" : "duplicate";
  }
}
