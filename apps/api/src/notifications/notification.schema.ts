import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const NOTIFICATION_TYPES = ["alert", "comment", "reaction", "message", "event", "group", "verification", "moderation", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationDocument = HydratedDocument<Notification>;

/** Persistent in-app notification (contract §6). */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "notifications" })
export class Notification {
  @Prop({ required: true })
  uid!: string;

  @Prop({ required: true, enum: NOTIFICATION_TYPES })
  type!: NotificationType;

  @Prop()
  actorUid?: string;

  @Prop({ required: true, maxlength: 140 })
  title!: string;

  @Prop({ maxlength: 280 })
  body?: string;

  /** In-app route, e.g. /p/<id>. */
  @Prop({ required: true })
  href!: string;

  /** Collapses repeats (e.g. several reactions on one post) into one row. */
  @Prop()
  groupKey?: string;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;

  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ uid: 1, createdAt: -1 });
NotificationSchema.index({ uid: 1, groupKey: 1, readAt: 1 });
// Keep notifications for 90 days.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
