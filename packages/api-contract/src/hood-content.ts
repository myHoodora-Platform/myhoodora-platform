/**
 * The Hood Team's content (docs/product/hood-activation-plan.md): the content bank, official posts,
 * the first-ten-days activation plan and the daily prompt. Admin → Hood content, and the composer's
 * starters. Mirrors apps/api/src/hood-content.
 */

export const CONTENT_TAGS = ["welcome", "starter", "info", "daily", "festive"] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];

export const CONTENT_TAG_LABELS: Record<ContentTag, string> = {
  welcome: "Welcome posts",
  starter: "Conversation starters",
  info: "Local information",
  daily: "Daily prompts",
  festive: "Festive",
};

export const TEAM_CATEGORIES = ["general", "recommendation", "for_sale", "event", "lost_found", "poll"] as const;
export type TeamCategory = (typeof TEAM_CATEGORIES)[number];

/** GET /admin/hood-content/items */
export interface ContentItem {
  _id: string;
  code: string;
  tag: ContentTag;
  category: TeamCategory;
  body: string;
  pollOptions: string[] | null;
  pollDays: number | null;
  pinDays: number | null;
  /** The local version for a city (real numbers and companies). */
  cityVariants: { city: string; body: string }[];
  /** The general text still has "[FILL: …]": it only posts where a city version exists. */
  needsLocalDetails: boolean;
  active: boolean;
  timesUsed: number;
  updatedAt: string;
}

export interface ContentItemInput {
  code?: string;
  tag?: ContentTag;
  category?: TeamCategory;
  body?: string;
  pollOptions?: string[];
  pollDays?: number;
  pinDays?: number | null;
  cityVariants?: { city: string; body: string }[];
  active?: boolean;
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  problems: { line: number; heading: string; problem: string }[];
}

/** Which Hoods: chosen ones, every open Hood in some cities, or all. */
export interface HoodTarget {
  hoodIds?: string[];
  cities?: string[];
  allHoods?: boolean;
}

export interface ComposeInput extends HoodTarget {
  itemId?: string;
  message?: string;
  category?: TeamCategory;
  pollOptions?: string[];
  pollDays?: number;
  eventDate?: string;
  eventLocation?: string;
  pinDays?: number;
  /** ISO time; omitted = now. */
  runAt?: string;
}

export interface ActivationInput extends HoodTarget {
  /** Lagos date of day 0 (YYYY-MM-DD); omitted = today. */
  startDate?: string;
  /** Hoods with at least this many posts are left alone (default 15). */
  skipIfPostsAtLeast?: number;
}

export interface ScheduleResult {
  batchId: string;
  hoods: number;
  scheduled: number;
  alreadyScheduled: number;
  needsLocalDetails: { code: string; cities: string[] }[];
  activeHoods?: number;
}

export type ScheduledStatus = "scheduled" | "published" | "cancelled" | "skipped" | "failed";
export type ScheduleSource = "compose" | "activation" | "daily";

export interface ScheduledTeamPost {
  _id: string;
  hoodId: string;
  hoodName: string;
  source: ScheduleSource;
  batchId: string;
  code: string | null;
  message: string;
  category: TeamCategory;
  pinDays: number | null;
  runAt: string;
  status: ScheduledStatus;
  postId: string | null;
  problem: string | null;
}

export interface DailySettings {
  enabled: boolean;
  /** Lagos hour, 0–23. */
  hour: number;
  calendar: Record<string, string>;
  minNeighbours: number;
}

/** GET /admin/hood-content/daily */
export interface DailyOverview {
  daily: DailySettings;
  dailyDoneFor: string | null;
  upcoming: { date: string; code: string | null; chosen: boolean; text: string | null }[];
}

/** GET /hood-content/starters */
export interface ConversationStarter {
  code: string;
  category: string;
  text: string;
}
