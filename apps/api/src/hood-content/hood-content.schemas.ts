import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { CONTENT_TAGS, TEAM_CATEGORIES, type ContentTag, type TeamCategory } from "./domain/content-bank";

/**
 * One ready-made Hood Team post in the content bank (docs/product/hood-content-bank.md). Imported
 * from the markdown file by code, then edited in Admin → Hood content. `cityVariants` hold the local
 * version of an info item (real numbers and companies for Lagos, for Ibadan…).
 */
@Schema({ timestamps: true, collection: "hood_content_items" })
export class ContentItem {
  @Prop({ required: true, unique: true, trim: true, maxlength: 12 })
  code!: string;

  @Prop({ required: true, enum: CONTENT_TAGS })
  tag!: ContentTag;

  @Prop({ required: true, enum: TEAM_CATEGORIES })
  category!: TeamCategory;

  @Prop({ required: true, maxlength: 2000 })
  body!: string;

  @Prop({ type: [String], default: undefined })
  pollOptions?: string[];

  @Prop({ min: 1, max: 7 })
  pollDays?: number;

  @Prop({ min: 1, max: 30 })
  pinDays?: number;

  @Prop({ type: [{ city: String, body: String, _id: false }], default: [] })
  cityVariants!: { city: string; body: string }[];

  /** Switched off: not offered, not rotated, not used by plans. */
  @Prop({ default: true })
  active!: boolean;

  /** Posts made from it so far. */
  @Prop({ default: 0 })
  timesUsed!: number;

  @Prop() updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
export type ContentItemDocument = HydratedDocument<ContentItem>;
export const ContentItemSchema = SchemaFactory.createForClass(ContentItem);
ContentItemSchema.index({ tag: 1, active: 1, code: 1 });

export const SCHEDULED_STATUSES = ["scheduled", "published", "cancelled", "skipped", "failed"] as const;
export type ScheduledStatus = (typeof SCHEDULED_STATUSES)[number];
export const SCHEDULE_SOURCES = ["compose", "activation", "daily"] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

/**
 * A Hood Team post waiting to go out in one Hood (or that went out). The `hood-content.publish` job
 * posts it at `runAt`; this record is what the admin lists and cancels, and what makes a repeat run
 * harmless: the job does nothing unless the status is still "scheduled", and the post itself carries
 * `clientId = hc-<this id>`, so a retried job returns the post it already made.
 */
@Schema({ timestamps: true, collection: "hood_content_scheduled" })
export class ScheduledPost {
  @Prop({ required: true, index: true })
  hoodId!: string;

  @Prop({ required: true, enum: SCHEDULE_SOURCES })
  source!: ScheduleSource;

  /** One "post to these Hoods" action: cancel them together. */
  @Prop({ required: true, index: true })
  batchId!: string;

  @Prop() contentItemId?: string;
  @Prop() code?: string;

  /** The text as it will be posted (Hood details already filled in). */
  @Prop({ required: true, maxlength: 8192 })
  message!: string;

  @Prop({ required: true, enum: TEAM_CATEGORIES })
  category!: TeamCategory;

  @Prop({ type: [String], default: undefined }) pollOptions?: string[];
  @Prop() pollDays?: number;
  @Prop() eventDate?: Date;
  @Prop({ maxlength: 200 }) eventLocation?: string;
  @Prop() pinDays?: number;

  @Prop({ required: true, index: true })
  runAt!: Date;

  @Prop({ required: true, enum: SCHEDULED_STATUSES, default: "scheduled", index: true })
  status!: ScheduledStatus;

  @Prop() postId?: string;
  @Prop() problem?: string;
  @Prop() publishedAt?: Date;

  /** Staff uid, or "system" for daily prompts. */
  @Prop({ required: true })
  createdBy!: string;

  /** Activation and daily posts: one per Hood and item/day, however often the plan is applied. */
  @Prop()
  dedupeKey?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
export type ScheduledPostDocument = HydratedDocument<ScheduledPost>;
export const ScheduledPostSchema = SchemaFactory.createForClass(ScheduledPost);
ScheduledPostSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
ScheduledPostSchema.index({ status: 1, runAt: 1 });

export interface DailySettings {
  /** Post a daily prompt to every open Hood. */
  enabled: boolean;
  /** Lagos hour it goes out (0–23). */
  hour: number;
  /** Chosen items by Lagos date (YYYY-MM-DD → code); other days rotate through the bank. */
  calendar: Record<string, string>;
  /** Skip Hoods with fewer verified neighbours than this (0 = every open Hood). */
  minNeighbours: number;
}

export const DEFAULT_DAILY: DailySettings = { enabled: false, hour: 8, calendar: {}, minNeighbours: 0 };

/** Singleton (key "hood-content"). */
@Schema({ timestamps: true, collection: "hood_content_settings" })
export class HoodContentSettings {
  @Prop({ required: true, unique: true, default: "hood-content" })
  key!: string;

  @Prop({ type: Object, default: () => ({ ...DEFAULT_DAILY, calendar: {} }) })
  daily!: DailySettings;

  /** The Lagos date the daily prompt last went out: claimed atomically, so it goes out once a day. */
  @Prop() dailyDoneFor?: string;
}
export type HoodContentSettingsDocument = HydratedDocument<HoodContentSettings>;
export const HoodContentSettingsSchema = SchemaFactory.createForClass(HoodContentSettings);
