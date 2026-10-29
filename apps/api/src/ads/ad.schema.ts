import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

/** `listings`: a seller's own For Sale items, shown live from their listings (the admin picks the seller). */
export const AD_FORMATS = ["image", "video", "carousel", "announcement", "business", "listings"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const AD_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

/** What the button says (and does: `call` dials `phone`, the rest open `url`). */
export const AD_CTAS = ["learn_more", "shop", "call", "visit", "directions", "sign_up", "contact"] as const;
export type AdCta = (typeof AD_CTAS)[number];

/** Announcement backgrounds: named, so the app maps them to its own colours in light and dark. */
export const AD_BACKGROUNDS = ["green", "blue", "amber", "rose", "slate"] as const;
export type AdBackground = (typeof AD_BACKGROUNDS)[number];

export const AD_EVENT_TYPES = ["impression", "click", "hide", "report", "video_play", "unmute", "swipe", "why"] as const;
/** What the app reports in batches (hide and report have their own routes). */
export const AD_TRACKED_TYPES = ["impression", "click", "video_play", "unmute", "swipe", "why"] as const;
export type AdTrackedType = (typeof AD_TRACKED_TYPES)[number];
export type AdEventType = (typeof AD_EVENT_TYPES)[number];

export type AdDocument = HydratedDocument<Ad>;

/**
 * A sponsored item shown in neighbourhood feeds (docs/feed-redesign-spec.md §5), managed by admins
 * (`ads.manage`). Never hard-deleted: `deletedAt` hides it everywhere and keeps its stats.
 */
@Schema({ timestamps: true, collection: "ads" })
export class Ad {
  /** For staff only (the list, the audit log); never shown in the feed. */
  @Prop({ required: true, trim: true, maxlength: 80 }) title!: string;
  @Prop({ required: true, trim: true, maxlength: 60 }) advertiserName!: string;
  @Prop() advertiserLogoUrl?: string;
  @Prop({ required: true, enum: AD_FORMATS }) format!: AdFormat;
  @Prop({ trim: true, maxlength: 500, default: "" }) primaryText!: string;
  @Prop({ trim: true, maxlength: 60 }) headline?: string;
  @Prop({ enum: AD_CTAS }) ctaType?: AdCta;
  @Prop() ctaUrl?: string;
  @Prop({ maxlength: 20 }) ctaPhone?: string;
  /** Image, video (with its poster) or a business's photo, in order. */
  @Prop({ type: [{ url: String, kind: { type: String, enum: ["image", "video"] }, posterUrl: String, _id: false }], default: [] })
  media!: { url: string; kind: "image" | "video"; posterUrl?: string }[];
  /** Carousel: 2 to 10 cards, each with its own link. */
  @Prop({ type: [{ imageUrl: String, headline: String, url: String, _id: false }], default: [] })
  cards!: { imageUrl: string; headline: string; url: string }[];
  @Prop({ enum: AD_BACKGROUNDS }) background?: AdBackground;
  /** `listings` ads: whose items. While the ad is live, neighbours it reaches may open them. */
  @Prop() sellerUid?: string;

  @Prop({ required: true, enum: AD_STATUSES, default: "draft" }) status!: AdStatus;
  @Prop({ type: Date, default: null }) startsAt?: Date | null;
  @Prop({ type: Date, default: null }) endsAt?: Date | null;
  /** 1–10: how often it wins a slot against other eligible ads. */
  @Prop({ required: true, min: 1, max: 10, default: 5 }) priority!: number;
  /** Times one neighbour may see it per day (Lagos time). */
  @Prop({ required: true, min: 1, max: 20, default: 3 }) dailyCapPerUser!: number;
  /**
   * All three empty: every neighbourhood. Otherwise these neighbourhoods, every one in these cities,
   * and every one whose centre is within `near.radiusKm` of a place (a neighbourhood's location, never
   * a neighbour's own).
   */
  @Prop({ type: [String], default: [] }) hoodIds!: string[];
  @Prop({ type: [String], default: [] }) cities!: string[];
  @Prop({ type: { lat: Number, lng: Number, radiusKm: Number, label: String }, _id: false, default: null })
  near?: { lat: number; lng: number; radiusKm: number; label?: string } | null;

  @Prop({ required: true }) createdBy!: string;
  @Prop({ type: Date, default: null }) deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export const AdSchema = SchemaFactory.createForClass(Ad);
// The feed's question: which ads are live now?
AdSchema.index({ status: 1, deletedAt: 1, startsAt: 1, endsAt: 1 });
// "Is this stored file used by an ad?" (StorageService.sweepUnreferenced).
AdSchema.index({ "media.url": 1 });
AdSchema.index({ "cards.imageUrl": 1 });
// "Is this seller promoted where this neighbour lives?" (ListingsService).
AdSchema.index({ sellerUid: 1, format: 1 }, { sparse: true });

/**
 * One thing a neighbour did with an ad. `key` (neighbour + ad + feed session + type) is unique, so a
 * resent impression or a double-tapped button counts once.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "ad_events" })
export class AdEvent {
  @Prop({ required: true }) adId!: string;
  @Prop({ required: true }) uid!: string;
  @Prop({ required: true, enum: AD_EVENT_TYPES }) type!: AdEventType;
  @Prop({ required: true }) sessionId!: string;
  @Prop({ required: true }) key!: string;
  /** The neighbour's home Hood when it happened (stats by area). */
  @Prop() hoodId?: string;
  /** Reports only: the reason given. */
  @Prop({ maxlength: 40 }) reason?: string;
  createdAt?: Date;
}
export const AdEventSchema = SchemaFactory.createForClass(AdEvent);
AdEventSchema.index({ key: 1 }, { unique: true });
AdEventSchema.index({ adId: 1, type: 1, createdAt: 1 });
// Daily caps: this neighbour's impressions of these ads today.
AdEventSchema.index({ uid: 1, type: 1, createdAt: 1 });

/** "Hide ad": never shown to this neighbour again. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "ad_hides" })
export class AdHide {
  @Prop({ required: true }) adId!: string;
  @Prop({ required: true }) uid!: string;
}
export const AdHideSchema = SchemaFactory.createForClass(AdHide);
AdHideSchema.index({ uid: 1, adId: 1 }, { unique: true });

/** The placement rules (§5.3), one document, tuned by admins. */
@Schema({ timestamps: true, collection: "ad_settings" })
export class AdSettings {
  @Prop({ required: true, unique: true, default: "ads" }) key!: string;
  @Prop() enabled?: boolean;
  @Prop() firstAfter?: number;
  @Prop() minGap?: number;
  @Prop() maxGap?: number;
  @Prop() minOrganic?: number;
}
export const AdSettingsSchema = SchemaFactory.createForClass(AdSettings);
