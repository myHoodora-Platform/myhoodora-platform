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
  /**
   * A reply: the top-level comment it sits under. Replies are one level deep, so a reply to a reply
   * sits under the same top-level comment and names whom it answers in `replyToUid`. Unset on
   * top-level comments (and on every comment written before replies existed).
   */
  @Prop() parentId?: string;
  @Prop() replyToUid?: string;
  /** Kept with each like and unlike (and replies shown), so a thread can be sorted without counting. */
  @Prop({ default: 0 }) likeCount!: number;
  @Prop({ default: 0 }) replyCount!: number;
  /** The app's id for this submission: sending it again (a lost response, a double tap) returns the same comment. */
  @Prop() clientId?: string;
  createdAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ postId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 }, { partialFilterExpression: { parentId: { $type: "string" } } });
CommentSchema.index({ authorUid: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

export type CommentLikeDocument = HydratedDocument<CommentLike>;

/** One neighbour's like on one comment. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "comment_likes" })
export class CommentLike {
  @Prop({ required: true }) commentId!: string;
  @Prop({ required: true, index: true }) uid!: string;
}

export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);
CommentLikeSchema.index({ commentId: 1, uid: 1 }, { unique: true });
