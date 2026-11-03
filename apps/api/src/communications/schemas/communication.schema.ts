import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const COMMUNICATION_STATUSES = ["queued", "sent", "delivered", "delivery_delayed", "bounced", "complained", "failed", "suppressed"] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export type CommunicationDocument = HydratedDocument<Communication>;

/**
 * One external message (email today; SMS/push later) and its delivery state.
 * A successful API call only means "sent"; "delivered" comes from webhooks.
 * No bodies or provider payloads are stored.
 */
@Schema({ timestamps: true, collection: "communications" })
export class Communication {
  @Prop({ index: true })
  uid?: string;

  @Prop({ required: true, enum: ["email", "sms", "push"] })
  channel!: "email" | "sms" | "push";

  /** Template / purpose, e.g. "welcome_verify", "verify_email", "account_action". */
  @Prop({ required: true, index: true })
  type!: string;

  @Prop({ required: true })
  provider!: string;

  /** Our de-duplication key; the same key is sent to the provider. */
  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({ unique: true, sparse: true })
  providerMessageId?: string;

  @Prop({ required: true, enum: COMMUNICATION_STATUSES, default: "queued", index: true })
  status!: CommunicationStatus;

  @Prop() sentAt?: Date;
  @Prop() deliveredAt?: Date;
  @Prop() failedAt?: Date;

  /** Short machine reason (e.g. "resend:validation_error"), never PII. */
  @Prop() error?: string;

  /** Webhook event ids already applied (svix-id) — makes processing idempotent. */
  @Prop({ type: [String], default: [] })
  processedEventIds!: string[];

  @Prop({ type: Object })
  metadata?: Record<string, string>;
}

export const CommunicationSchema = SchemaFactory.createForClass(Communication);
