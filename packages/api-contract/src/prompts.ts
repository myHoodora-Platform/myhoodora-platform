/**
 * Feedback prompts admins send to neighbours, and when the app asks for a store review (contract §33).
 */
export const PROMPT_KINDS = ["stars", "thumbs", "poll", "nps", "open"] as const;
export type PromptKind = (typeof PROMPT_KINDS)[number];

export const PROMPT_LAYOUTS = ["sheet", "dialog", "feed"] as const;
export type PromptLayout = (typeof PROMPT_LAYOUTS)[number];

export const PROMPT_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type PromptStatus = (typeof PROMPT_STATUSES)[number];

export type CommentMode = "off" | "optional" | "required";
export const PROMPT_ACCENTS = ["green", "blue", "amber", "rose", "slate"] as const;
export type PromptAccent = (typeof PROMPT_ACCENTS)[number];

/** Things neighbours do that the app reports (POST /engagement/signal), with words for admins. */
export const PROMPT_ACTIONS = {
  post_created: "Posts something",
  comment_created: "Comments",
  listing_created: "Lists something for sale",
  listing_sold: "Marks a listing sold",
  event_rsvp: "RSVPs to an event",
  message_sent: "Sends a message",
  address_verified: "Verifies their address",
  recommendation_posted: "Posts a recommendation",
} as const;
export const PROMPT_FEATURES = {
  search: "Search",
  for_sale: "For Sale & Free",
  events: "Events",
  groups: "Groups",
  messages: "Messages",
  notifications: "Notifications",
  saved: "Saved posts",
  profile: "Profile",
} as const;
export type PromptAction = keyof typeof PROMPT_ACTIONS;
export type PromptFeature = keyof typeof PROMPT_FEATURES;
export type SignalKey = "app_open" | PromptAction | PromptFeature;
export type TriggerType = "action" | "feature" | "open" | "manual";

export interface PromptOption {
  id: string;
  label: string;
  emoji?: string;
}

/** A prompt as the app shows it. */
export interface Prompt {
  _id: string;
  kind: PromptKind;
  question: string;
  detail?: string;
  options: PromptOption[];
  commentMode: CommentMode;
  commentLabel?: string;
  thanksMessage: string;
  layout: PromptLayout;
  accent: PromptAccent;
  emoji?: string;
  /** Wait this long after the trigger before showing it. */
  delaySeconds: number;
  /** Send back with the answer. */
  contextKey?: SignalKey;
  subjectId?: string;
}

/** POST /engagement/signal → */
export interface SignalResult {
  prompt: Prompt | null;
  /** Ask for an App Store / Play Store review now (expo-store-review). */
  storeReview: boolean;
}

export interface PromptAnswer {
  /** stars 1–5, nps 0–10, thumbs 1 (up) / 0 (down). */
  value?: number;
  optionId?: string;
  comment?: string;
  contextKey?: SignalKey;
  subjectId?: string;
  platform?: "ios" | "android" | "web";
}

/** As admins see and edit it. */
export interface AdminPrompt {
  _id: string;
  title: string;
  kind: PromptKind;
  question: string;
  detail?: string;
  options: PromptOption[];
  commentMode: CommentMode;
  commentLabel?: string;
  thanksMessage?: string;
  layout: PromptLayout;
  accent: PromptAccent;
  emoji?: string;
  triggerType: TriggerType;
  triggerKey?: SignalKey;
  triggerCount: number;
  delaySeconds: number;
  hoodIds: string[];
  cities: string[];
  minDaysSinceJoin?: number | null;
  maxDaysSinceJoin?: number | null;
  status: PromptStatus;
  effectiveStatus: PromptStatus;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  maxShows: number;
  push: boolean;
  sentAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** List only. */
  shown?: number;
  responses?: number;
}

export type AdminPromptInput = Partial<Omit<AdminPrompt, "_id" | "status" | "effectiveStatus" | "sentAt" | "createdAt" | "updatedAt" | "shown" | "responses">>;

export interface PromptResults {
  shown: number;
  dismissed: number;
  responses: number;
  responseRate: number;
  average: number | null;
  distribution: Record<string, number>;
  nps?: { promoters: number; passives: number; detractors: number; score: number };
  comments: { value: number | null; optionId?: string; comment: string; name: string; hood?: string; at: string }[];
}

export interface PromptSettings {
  cooldownDays: number;
  storeReview: { enabled: boolean; milestones: { key: SignalKey; count: number }[]; minDaysSinceJoin: number; cooldownDays: number };
}

/** PATCH /admin/prompts/settings takes these flat names. */
export interface PromptSettingsPatch {
  cooldownDays?: number;
  storeReviewEnabled?: boolean;
  storeReviewMilestones?: { key: SignalKey; count: number }[];
  storeReviewMinDaysSinceJoin?: number;
  storeReviewCooldownDays?: number;
}
