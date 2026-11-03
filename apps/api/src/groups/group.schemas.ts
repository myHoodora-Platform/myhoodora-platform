import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const GROUP_CATEGORIES = ["safety", "estate", "parents", "hobbies", "business", "other"] as const;
export const GROUP_PRIVACY = ["open", "private"] as const;
export const GROUP_BOUNDARIES = ["neighbourhood", "nearby", "city"] as const;
export type GroupPrivacy = (typeof GROUP_PRIVACY)[number];
export type GroupBoundary = (typeof GROUP_BOUNDARIES)[number];

export type GroupDocument = HydratedDocument<Group>;

/** Contract §8 (Nextdoor groups). */
@Schema({ timestamps: true, collection: "groups" })
export class Group {
  @Prop({ required: true, maxlength: 60 }) name!: string;
  /** Lower-cased name: unique per Hood (409 on clash). */
  @Prop({ required: true }) nameKey!: string;
  @Prop({ required: true, maxlength: 500 }) description!: string;
  @Prop({ type: String, required: true, enum: GROUP_PRIVACY }) privacy!: GroupPrivacy;
  @Prop({ type: String, required: true, enum: GROUP_CATEGORIES }) category!: (typeof GROUP_CATEGORIES)[number];
  @Prop({ type: String, required: true, enum: GROUP_BOUNDARIES, default: "neighbourhood" }) boundary!: GroupBoundary;
  @Prop() coverPhoto?: string;
  @Prop({ required: true, index: true }) neighborhoodId!: string;
  @Prop({ required: true }) city!: string;
  @Prop({ required: true }) createdBy!: string;
  @Prop({ default: false }) official!: boolean;
  @Prop({ default: 0 }) memberCount!: number;
  /** Random, rotatable: a valid token joins a private group without approval. */
  @Prop({ required: true }) inviteToken!: string;
  /** Archived by staff (moderation) — hidden, content kept. */
  @Prop({ type: Date, default: null }) archivedAt!: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ neighborhoodId: 1, nameKey: 1 }, { unique: true });

export type GroupMemberDocument = HydratedDocument<GroupMember>;
@Schema({ timestamps: { createdAt: "joinedAt", updatedAt: false }, collection: "group_members" })
export class GroupMember {
  @Prop({ required: true }) groupId!: string;
  @Prop({ required: true, index: true }) uid!: string;
  @Prop({ type: String, required: true, enum: ["admin", "member"], default: "member" }) role!: "admin" | "member";
  joinedAt?: Date;
}
export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);
GroupMemberSchema.index({ groupId: 1, uid: 1 }, { unique: true });

@Schema({ timestamps: { createdAt: "requestedAt", updatedAt: false }, collection: "group_requests" })
export class GroupRequest {
  @Prop({ required: true }) groupId!: string;
  @Prop({ required: true }) uid!: string;
  requestedAt?: Date;
}
export const GroupRequestSchema = SchemaFactory.createForClass(GroupRequest);
GroupRequestSchema.index({ groupId: 1, uid: 1 }, { unique: true });

@Schema({ timestamps: true, collection: "group_posts" })
export class GroupPost {
  @Prop({ required: true, index: true }) groupId!: string;
  @Prop({ required: true }) authorUid!: string;
  @Prop({ required: true, maxlength: 4000 }) content!: string;
  createdAt?: Date;
}
export const GroupPostSchema = SchemaFactory.createForClass(GroupPost);
GroupPostSchema.index({ groupId: 1, createdAt: -1 });
