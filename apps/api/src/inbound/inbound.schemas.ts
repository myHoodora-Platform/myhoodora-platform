import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const INBOX_SOURCES = ["in_app", "contact_form", "feedback"] as const;
export const INBOX_STATUSES = ["open", "waiting", "resolved"] as const;
export const INBOX_PRIORITIES = ["low", "normal", "high"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];
export type InboxStatus = (typeof INBOX_STATUSES)[number];
export type InboxPriority = (typeof INBOX_PRIORITIES)[number];

export interface ThreadMessage {
  from: "user" | "staff";
  body: string;
  at: Date;
  /** Staff display name on replies. */
  by?: string;
}

export type InboundMessageDocument = HydratedDocument<InboundMessage>;

/**
 * One support thread in the team inbox (contract §13.8): in-app support
 * requests, the public contact form and app feedback, with staff replies.
 */
@Schema({ timestamps: true, collection: "inbound_messages" })
export class InboundMessage {
  /** Legacy pass-1 rows used "feedback" | "contact"; read as feedback | contact_form. */
  @Prop({ required: true }) source!: string;
  @Prop({ required: true }) kind!: string;
  @Prop() subject?: string;
  @Prop() uid?: string;
  @Prop() name?: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop({ maxlength: 120 }) organisation?: string;
  /** First message (kept for pass-1 rows; new rows also store it in `messages`). */
  @Prop({ maxlength: 2000 }) message?: string;
  @Prop({ maxlength: 200 }) path?: string;
  @Prop({ type: [{ from: String, body: String, at: Date, by: String }], _id: false, default: [] }) messages!: ThreadMessage[];
  @Prop({ type: String, required: true, enum: INBOX_STATUSES, default: "open", index: true }) status!: InboxStatus;
  @Prop({ type: String, enum: INBOX_PRIORITIES, default: "normal" }) priority!: InboxPriority;
  @Prop({ type: Object }) assignee?: { uid: string; displayName: string };
  createdAt?: Date;
  updatedAt?: Date;
}
export const InboundMessageSchema = SchemaFactory.createForClass(InboundMessage);
InboundMessageSchema.index({ status: 1, priority: -1, updatedAt: 1 });

/** myHoodora AI pilot waitlist (contract §11b). One row per email + institution. */
@Schema({ timestamps: true, collection: "ai_pilot_requests" })
export class AiPilotRequest {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, lowercase: true, trim: true }) email!: string;
  @Prop({ required: true }) institution!: string;
  @Prop({ required: true }) institutionKey!: string;
  @Prop({ required: true }) institutionType!: string;
  @Prop() role?: string;
  @Prop() subjects?: string;
  createdAt?: Date;
}
export const AiPilotRequestSchema = SchemaFactory.createForClass(AiPilotRequest);
AiPilotRequestSchema.index({ email: 1, institutionKey: 1 }, { unique: true });

/** Careers talent network (contract §11c). One row per email (latest details win). */
@Schema({ timestamps: true, collection: "talent_profiles" })
export class TalentProfile {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email!: string;
  @Prop({ required: true }) team!: string;
  @Prop({ required: true }) city!: string;
  @Prop() link?: string;
  @Prop() note?: string;
  createdAt?: Date;
}
export const TalentProfileSchema = SchemaFactory.createForClass(TalentProfile);
