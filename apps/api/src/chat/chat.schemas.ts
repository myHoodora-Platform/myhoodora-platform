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
  /** Pinned to the top of their inbox (2026-10-28), up to 3. */
  pinnedAt?: Date | null;
}

/** A message pinned in the conversation for everyone in it, until `until` (24 h, 7 or 30 days). */
export interface PinnedMessage {
  messageId: string;
  by: string;
  at: Date;
  until: Date;
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
    type: [{ uid: String, unread: { type: Number, default: 0 }, lastReadAt: Date, archivedAt: Date, clearedAt: Date, mutedUntil: Date, pinnedAt: Date }],
    _id: false,
    default: [],
  })
  members!: ConversationMember[];
  @Prop({ type: Object }) context?: ChatContext;
  /** Pinned messages, newest first, at most 3 (WhatsApp's pinned bar). */
  @Prop({ type: [{ messageId: String, by: String, at: Date, until: Date }], _id: false, default: undefined }) pins?: PinnedMessage[];
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
  /** The message this one answers (same conversation), WhatsApp's reply. */
  @Prop() replyTo?: string;
  /** One emoji per person; picking another replaces theirs. */
  @Prop({ type: [{ uid: String, emoji: String, _id: false }], default: undefined }) reactions?: { uid: string; emoji: string }[];
  /** The sender changed the words (within EDIT_WINDOW). Earlier words aren't kept for others to see. */
  @Prop() editedAt?: Date;
  /** Deleted for everyone: shown as "This message was deleted". */
  @Prop() deletedAt?: Date;
  /** What it said, kept out of every response, for a report about it. */
  @Prop({ select: false }) removedBody?: string;
  createdAt?: Date;
}
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
