import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true, collection: "comments" })
export class Comment {
  @Prop({ required: true }) postId!: string;
  @Prop({ required: true, index: true }) authorUid!: string;
  @Prop({ required: true, maxlength: 1000 }) content!: string;
  /** Author/staff delete. */
  @Prop({ type: Date, default: null }) deletedAt?: Date | null;
  /** Moderation removal (restorable). */
  @Prop({ type: Date, default: null }) removedAt?: Date | null;
  createdAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ postId: 1, createdAt: 1 });
