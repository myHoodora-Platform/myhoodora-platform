import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { ALERT_CATEGORIES } from "../../platform/platform-settings.schema";
import { POST_CATEGORIES, POST_VISIBILITIES, type PostCategory, type PostType, type PostVisibility } from "../domain/post-meta";

export const REACTION_TYPES = ["like", "helpful", "agree", "haha", "wow", "sad"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export type PostDocument = HydratedDocument<FeedPost>;

/**
 * A neighbourhood post. `content` keeps the legacy encoded form for older
 * clients; `message` + typed fields are the source of truth (contract §1).
 * `isActive:false` = deleted by the author; `removedAt` = removed by moderation.
 */
@Schema({ timestamps: true, collection: "posts" })
export class FeedPost {
  @Prop({ required: true, index: true })
  authorUid!: string;

  @Prop({ required: true })
  neighborhoodId!: string;

  @Prop({ required: true, enum: ["text", "image", "event", "alert"], default: "text" })
  type!: PostType;

  /** Legacy: message with the `<!--mh:{…}-->` prefix (read by the current web client). */
  @Prop({ required: true, maxlength: 9000 })
  content!: string;

  @Prop({ maxlength: 8192 })
  message?: string;

  @Prop({ enum: POST_CATEGORIES, default: "general" })
  category!: PostCategory;

  @Prop({ enum: ALERT_CATEGORIES })
  alertCategory?: string;

  @Prop({ default: false })
  urgent!: boolean;

  @Prop() eventDate?: Date;
  /** Host notices already sent for this event ("host_2d", "host_followup"); claimed atomically, so exactly once. */
  @Prop({ type: [String], default: undefined }) hostNotices?: string[];
  @Prop({ maxlength: 200 }) eventLocation?: string;
  @Prop({ maxlength: 80 }) thankedName?: string;
  @Prop({ type: Number, default: undefined }) priceNaira?: number | null;

  @Prop({ type: { options: [{ id: String, text: String, _id: false }], closesAt: Date }, _id: false })
  poll?: { options: { id: string; text: string }[]; closesAt: Date };

  @Prop({ enum: POST_VISIBILITIES, default: "neighbourhood" })
  visibility!: PostVisibility;

  @Prop({ type: { type: String, enum: ["Point"] }, coordinates: { type: [Number], default: undefined }, _id: false })
  location?: { type: "Point"; coordinates: [number, number] };

  @Prop({ type: [String], default: [] })
  mediaUrls!: string[];

  /** @deprecated legacy likes (migrated into the reactions collection). */
  @Prop({ type: [String], default: undefined })
  likes?: string[];

  @Prop({ type: Object, default: () => ({}) })
  reactionCounts!: Partial<Record<ReactionType, number>>;

  @Prop({ default: 0, min: 0 })
  commentCount!: number;

  @Prop({ default: false })
  commentsDisabled!: boolean;

  /** Alerts: end of the active window (settings.alertWindows at creation). */
  @Prop() activeUntil?: Date;
  @Prop({ type: Date, default: null }) resolvedAt?: Date | null;
  @Prop() resolvedBy?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  removedAt?: Date | null;

  @Prop() removedBy?: string;

  /** The author has deactivated their account: hidden from neighbours until they come back (AccountLifecycle). */
  @Prop() authorDeactivated?: boolean;

  /**
   * An id the client made up for this submission. Sending the same one again (a retry after a
   * timeout) returns this post instead of creating another: see the unique index below.
   */
  @Prop() clientId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(FeedPost);
PostSchema.index({ neighborhoodId: 1, isActive: 1, createdAt: -1 });
PostSchema.index({ neighborhoodId: 1, category: 1, createdAt: -1 });
// The reminder scheduler scans events by date.
PostSchema.index({ category: 1, eventDate: 1 });
// "Is this stored file still used by a post?" (StorageService.sweepUnreferenced).
PostSchema.index({ mediaUrls: 1 });
// One post per author per client-made id. Partial: posts without an id (older clients) are not constrained.
PostSchema.index({ authorUid: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

/** One reaction per person per post (unique), replaces the unbounded likes[] array. */
@Schema({ timestamps: true, collection: "reactions" })
export class Reaction {
  @Prop({ required: true }) postId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ required: true, enum: REACTION_TYPES }) type!: ReactionType;
}
export const ReactionSchema = SchemaFactory.createForClass(Reaction);
ReactionSchema.index({ postId: 1, uid: 1 }, { unique: true });

/** Anonymous poll votes: never exposed per person (contract §1 Polls). */
@Schema({ timestamps: true, collection: "poll_votes" })
export class PollVote {
  @Prop({ required: true }) postId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ required: true }) optionId!: string;
}
export const PollVoteSchema = SchemaFactory.createForClass(PollVote);
PollVoteSchema.index({ postId: 1, uid: 1 }, { unique: true });
PollVoteSchema.index({ postId: 1, optionId: 1 });

@Schema({ timestamps: true, collection: "rsvps" })
export class Rsvp {
  @Prop({ required: true }) postId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ required: true, enum: ["going", "interested"] }) status!: "going" | "interested";
  /** Reminders already sent to this person for this event; claimed atomically, so exactly once (event-reminders.service). */
  @Prop({ type: [String], default: [] }) remindersSent!: string[];
  updatedAt?: Date;
}
export const RsvpSchema = SchemaFactory.createForClass(Rsvp);
RsvpSchema.index({ postId: 1, uid: 1 }, { unique: true });
RsvpSchema.index({ postId: 1, status: 1 });
