import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export interface ChatContext {
  type: "listing";
  id: string;
  title: string;
  photo?: string;
  priceNaira: number | null;
}

export interface ConversationMember {
  uid: string;
  unread: number;
  lastReadAt?: Date;
  archivedAt?: Date | null;
  clearedAt?: Date | null;
  mutedUntil?: Date | null;
}

export type ConversationDocument = HydratedDocument<Conversation>;

/** Contract §5. One thread per pair of neighbours + context (listing id or "direct"). */
@Schema({ timestamps: true, collection: "conversations" })
export class Conversation {
  /** Sorted participant uids + ":" + context id — makes POST idempotent. */
  @Prop({ required: true, unique: true }) threadKey!: string;
  @Prop({ type: [String], required: true, index: true }) participantUids!: string[];
  /**
   * Per person: unread count, when they last read it, and their own choices (2026-10-28): archived
   * (out of the main list until something new arrives), cleared (deleted for them: earlier messages
   * hidden from them only) and muted (no notifications until then).
   */
  @Prop({
    type: [{ uid: String, unread: { type: Number, default: 0 }, lastReadAt: Date, archivedAt: Date, clearedAt: Date, mutedUntil: Date }],
    _id: false,
    default: [],
  })
  members!: ConversationMember[];
  @Prop({ type: Object }) context?: ChatContext;
  @Prop({ type: Object }) lastMessage?: { body: string; senderUid: string; createdAt: Date };
  @Prop({ required: true }) startedBy!: string;
  /** Closed by staff after a report. */
  @Prop({ type: Date, default: null }) removedAt!: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participantUids: 1, updatedAt: -1 });

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "messages" })
export class Message {
  @Prop({ required: true, index: true }) conversationId!: string;
  @Prop({ required: true }) senderUid!: string;
  /** May be empty when the message is photos only. */
  @Prop({ default: "", maxlength: 2000 }) body!: string;
  /** Up to 4 photos the sender uploaded for messages (2026-10-28). */
  @Prop({ type: [String], default: undefined }) photos?: string[];
  createdAt?: Date;
}
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
