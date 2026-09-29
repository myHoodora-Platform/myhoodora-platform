import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export interface ChatContext {
  type: "listing";
  id: string;
  title: string;
  photo?: string;
  priceNaira: number | null;
}

export type ConversationDocument = HydratedDocument<Conversation>;

/** Contract §5. One thread per pair of neighbours + context (listing id or "direct"). */
@Schema({ timestamps: true, collection: "conversations" })
export class Conversation {
  /** Sorted participant uids + ":" + context id — makes POST idempotent. */
  @Prop({ required: true, unique: true }) threadKey!: string;
  @Prop({ type: [String], required: true, index: true }) participantUids!: string[];
  @Prop({ type: [{ uid: String, unread: { type: Number, default: 0 }, lastReadAt: Date }], _id: false, default: [] })
  members!: { uid: string; unread: number; lastReadAt?: Date }[];
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
  @Prop({ required: true, maxlength: 2000 }) body!: string;
  createdAt?: Date;
}
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
