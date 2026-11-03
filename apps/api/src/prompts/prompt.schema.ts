import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

/** What the neighbour answers with; each has its own interactive layout in the app. */
export const PROMPT_KINDS = ["stars", "thumbs", "poll", "nps", "open"] as const;
export type PromptKind = (typeof PROMPT_KINDS)[number];

/** How it appears: a sheet from the bottom, a card in the middle of the screen, or a card at the top of the feed. */
export const PROMPT_LAYOUTS = ["sheet", "dialog", "feed"] as const;
export type PromptLayout = (typeof PROMPT_LAYOUTS)[number];

export const PROMPT_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type PromptStatus = (typeof PROMPT_STATUSES)[number];

export const COMMENT_MODES = ["off", "optional", "required"] as const;
export type CommentMode = (typeof COMMENT_MODES)[number];

/** Named colours each app maps to its own light and dark shades (as ad announcements do). */
export const PROMPT_ACCENTS = ["green", "blue", "amber", "rose", "slate"] as const;

/** Things a neighbour does that can show a prompt ("after an action"); the app reports them. */
export const PROMPT_ACTIONS = ["post_created", "comment_created", "listing_created", "listing_sold", "event_rsvp", "message_sent", "address_verified", "recommendation_posted"] as const;
/** Parts of the app whose use can show a prompt ("after using a feature N times"). */
export const PROMPT_FEATURES = ["search", "for_sale", "events", "groups", "messages", "notifications", "saved", "profile"] as const;
export const SIGNAL_KEYS = ["app_open", ...PROMPT_ACTIONS, ...PROMPT_FEATURES] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];

export const TRIGGER_TYPES = ["action", "feature", "open", "manual"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export type PromptDocument = HydratedDocument<Prompt>;

/**
 * A question admins ask neighbours in the app (stars, thumbs, a poll, would-you-recommend 0–10, or an
 * open question), shown when its trigger happens, to its audience, within its dates, no more than
 * `maxShows` times each and never more often than the cooldown in the settings.
 */
@Schema({ timestamps: true, collection: "prompts" })
export class Prompt {
  @Prop({ required: true, trim: true, maxlength: 80 }) title!: string;
  @Prop({ required: true, enum: PROMPT_KINDS }) kind!: PromptKind;
  @Prop({ required: true, trim: true, maxlength: 140 }) question!: string;
  @Prop({ trim: true, maxlength: 240 }) detail?: string;
  /** Polls: 2–6 choices. */
  @Prop({ type: [{ id: String, label: String, emoji: String, _id: false }], default: [] }) options!: { id: string; label: string; emoji?: string }[];
  @Prop({ enum: COMMENT_MODES, default: "optional" }) commentMode!: CommentMode;
  @Prop({ trim: true, maxlength: 80 }) commentLabel?: string;
  @Prop({ trim: true, maxlength: 140 }) thanksMessage?: string;
  @Prop({ enum: PROMPT_LAYOUTS, default: "sheet" }) layout!: PromptLayout;
  @Prop({ enum: PROMPT_ACCENTS, default: "green" }) accent!: string;
  @Prop({ maxlength: 8 }) emoji?: string;

  @Prop({ required: true, enum: TRIGGER_TYPES }) triggerType!: TriggerType;
  /** action/feature triggers: which one. */
  @Prop({ enum: SIGNAL_KEYS }) triggerKey?: SignalKey;
  /** After the Nth time (1 = the first). */
  @Prop({ default: 1, min: 1, max: 100 }) triggerCount!: number;
  /** Seconds to wait before showing, so it never interrupts the moment itself. */
  @Prop({ default: 2, min: 0, max: 30 }) delaySeconds!: number;

  /** Both empty: everyone. */
  @Prop({ type: [String], default: [] }) hoodIds!: string[];
  @Prop({ type: [String], default: [] }) cities!: string[];
  /** Only people who joined at least / at most this many days ago. */
  @Prop({ type: Number, default: null }) minDaysSinceJoin?: number | null;
  @Prop({ type: Number, default: null }) maxDaysSinceJoin?: number | null;

  @Prop({ required: true, enum: PROMPT_STATUSES, default: "draft" }) status!: PromptStatus;
  @Prop({ type: Date, default: null }) startsAt?: Date | null;
  @Prop({ type: Date, default: null }) endsAt?: Date | null;
  /** Higher first when several could show. */
  @Prop({ default: 5, min: 1, max: 10 }) priority!: number;
  /** Times one person may see it if they close it without answering. */
  @Prop({ default: 2, min: 1, max: 5 }) maxShows!: number;
  /** Manual prompts: also send a push notification when sent. */
  @Prop({ default: false }) push!: boolean;
  /** Manual prompts: when it was sent (it shows from then on). */
  @Prop({ type: Date, default: null }) sentAt?: Date | null;

  @Prop({ required: true }) createdBy!: string;
  @Prop({ type: Date, default: null }) deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export const PromptSchema = SchemaFactory.createForClass(Prompt);
PromptSchema.index({ status: 1, deletedAt: 1, triggerType: 1, triggerKey: 1 });

/** One neighbour's answer to one prompt (one each: a second answer replaces nothing, it's refused). */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "prompt_responses" })
export class PromptResponse {
  @Prop({ required: true }) promptId!: string;
  @Prop({ required: true }) uid!: string;
  /** stars 1–5, nps 0–10, thumbs 1 (up) or 0 (down). */
  @Prop({ type: Number, default: null }) value?: number | null;
  @Prop() optionId?: string;
  @Prop({ trim: true, maxlength: 1000 }) comment?: string;
  /** What showed it (the action or feature), and the thing it was about, if any. */
  @Prop() contextKey?: string;
  @Prop() subjectId?: string;
  @Prop() hoodId?: string;
  @Prop({ enum: ["ios", "android", "web"] }) platform?: string;
  createdAt?: Date;
}
export const PromptResponseSchema = SchemaFactory.createForClass(PromptResponse);
PromptResponseSchema.index({ promptId: 1, uid: 1 }, { unique: true });
PromptResponseSchema.index({ promptId: 1, createdAt: -1 });

/** How often a prompt was shown to one neighbour, and whether they closed it. */
@Schema({ timestamps: true, collection: "prompt_exposures" })
export class PromptExposure {
  @Prop({ required: true }) promptId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ default: 0 }) shows!: number;
  @Prop({ default: 0 }) dismissals!: number;
  @Prop({ type: Date }) lastShownAt?: Date;
}
export const PromptExposureSchema = SchemaFactory.createForClass(PromptExposure);
PromptExposureSchema.index({ promptId: 1, uid: 1 }, { unique: true });

/**
 * Per neighbour: how many times they did each thing (for "after the 3rd time"), plus when they were
 * last shown any prompt and last asked for a store review (keys `prompt_shown`, `store_review`).
 */
@Schema({ timestamps: true, collection: "engagement_counters" })
export class EngagementCounter {
  @Prop({ required: true }) uid!: string;
  @Prop({ required: true }) key!: string;
  @Prop({ default: 0 }) count!: number;
  @Prop({ type: Date }) lastAt?: Date;
}
export const EngagementCounterSchema = SchemaFactory.createForClass(EngagementCounter);
EngagementCounterSchema.index({ uid: 1, key: 1 }, { unique: true });

/** Cooldown between prompts, and when the app asks for an App Store / Play Store review. */
@Schema({ timestamps: true, collection: "prompt_settings" })
export class PromptSettings {
  @Prop({ required: true, unique: true, default: "prompts" }) key!: string;
  @Prop() cooldownDays?: number;
  @Prop() storeReviewEnabled?: boolean;
  /** Each: after the Nth time they do this. */
  @Prop({ type: [{ key: String, count: Number, _id: false }], default: undefined }) storeReviewMilestones?: { key: string; count: number }[];
  @Prop() storeReviewMinDaysSinceJoin?: number;
  @Prop() storeReviewCooldownDays?: number;
}
export const PromptSettingsSchema = SchemaFactory.createForClass(PromptSettings);
