/**
 * Sponsored items in the neighbourhood feed (contract §32; docs/feed-redesign-spec.md §5). The app
 * reads `FeedPage`; the admin web manages `AdminAd`s.
 */
import type { ApiPost, PostCategory } from "./types";

export const AD_FORMATS = ["image", "video", "carousel", "announcement", "business"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const AD_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

/** What the button does: `call` dials `phone`, the rest open `url`. */
export const AD_CTAS = ["learn_more", "shop", "call", "visit", "directions", "sign_up", "contact"] as const;
export type AdCta = (typeof AD_CTAS)[number];

export const AD_CTA_LABELS: Record<AdCta, string> = {
  learn_more: "Learn more",
  shop: "Shop now",
  call: "Call",
  visit: "Visit",
  directions: "Get directions",
  sign_up: "Sign up",
  contact: "Contact us",
};

/** Announcement backgrounds, by name: each app maps them to its own colours (light and dark). */
export const AD_BACKGROUNDS = ["green", "blue", "amber", "rose", "slate"] as const;
export type AdBackground = (typeof AD_BACKGROUNDS)[number];

export interface AdMedia {
  url: string;
  kind: "image" | "video";
  /** Videos: the still shown before it plays. */
  posterUrl?: string;
}

export interface AdCard {
  imageUrl: string;
  headline: string;
  url: string;
}

/** An ad as the feed sends it: only what's shown. */
export interface FeedAd {
  _id: string;
  format: AdFormat;
  advertiser: { name: string; logoUrl?: string };
  primaryText: string;
  headline?: string;
  cta: { type: AdCta; label: string; url?: string; phone?: string } | null;
  media: AdMedia[];
  cards: AdCard[];
  background?: AdBackground;
  /** "Why am I seeing this?" */
  why: string;
}

export type FeedItem = { type: "post"; data: ApiPost } | { type: "ad"; slotId: string; data: FeedAd };

/** GET /feed/hood/:id. Send `nextCursor` back as `cursor` for the next page; null means the end. */
export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface FeedPageQuery {
  limit?: number;
  cursor?: string;
  category?: PostCategory;
  /** Made up by the app each time the feed opens or is refreshed (8–64 of A–Z a–z 0–9 - _). */
  session: string;
}

/** POST /ads/events: each counts once per neighbour, ad, feed session and kind. */
export interface AdEventInput {
  adId: string;
  type: "impression" | "click";
  sessionId: string;
}

export interface AdStats {
  impressions: number;
  /** Different neighbours who saw it. */
  reach: number;
  clicks: number;
  /** Clicks per 100 impressions, two decimals. */
  ctr: number;
  hides: number;
  reports: number;
}

/** An ad as admins see it (GET /admin/ads, /admin/ads/:id). */
export interface AdminAd {
  _id: string;
  title: string;
  advertiserName: string;
  advertiserLogoUrl?: string;
  format: AdFormat;
  primaryText: string;
  headline?: string;
  ctaType?: AdCta;
  ctaUrl?: string;
  ctaPhone?: string;
  media: AdMedia[];
  cards: AdCard[];
  background?: AdBackground;
  status: AdStatus;
  /** "ended" once its end date has passed, whatever `status` says. */
  effectiveStatus: AdStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** 1–10. */
  priority: number;
  dailyCapPerUser: number;
  /** Both empty: everywhere. */
  hoodIds: string[];
  cities: string[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: AdStats;
}

/** POST /admin/ads, PATCH /admin/ads/:id. */
export type AdminAdInput = Partial<Omit<AdminAd, "_id" | "status" | "effectiveStatus" | "createdBy" | "createdAt" | "updatedAt" | "stats">>;

export interface AdStatsRange extends AdStats {
  from: string;
  to: string;
  daily: { day: string; impressions: number; clicks: number }[];
}

/** GET/PATCH /admin/ads/settings. */
export interface AdPlacementSettings {
  enabled: boolean;
  /** Posts before the first ad. */
  firstAfter: number;
  /** Posts between ads: a number in this range, per slot. */
  minGap: number;
  maxGap: number;
  /** Pages with fewer posts get no ads. */
  minOrganic: number;
}
