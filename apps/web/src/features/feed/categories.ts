import {
  AlertTriangle,
  BarChart3,
  BadgeAlert,
  CalendarDays,
  Car,
  Droplets,
  Flame,
  HandHeart,
  MessageCircle,
  Search,
  ShieldAlert,
  Tag,
  ThumbsUp,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AlertCategory, Post, PostCategory, ReactionType } from "@/lib/api/types";
import { alertStatus } from "@/features/alerts/lifecycle";

// ── Composer categories (Nextdoor: "choose what you're posting") ───────────

export interface CategoryDef {
  id: PostCategory;
  label: string;
  /** Short label for badges on post cards. */
  badge: string;
  hint: string;
  icon: LucideIcon;
}

export const POST_CATEGORIES: CategoryDef[] = [
  { id: "general", label: "General", badge: "General", hint: "Share an update or ask neighbours a question", icon: MessageCircle },
  { id: "recommendation", label: "Ask for a recommendation", badge: "Recommendation", hint: "Find a trusted electrician, tailor, school…", icon: ThumbsUp },
  { id: "alert", label: "Alert neighbours", badge: "Alert", hint: "Security, power, flooding, traffic, scams", icon: AlertTriangle },
  { id: "event", label: "Event", badge: "Event", hint: "Invite neighbours to something happening nearby", icon: CalendarDays },
  { id: "for_sale", label: "Sell or give away", badge: "For sale", hint: "List an item in For Sale & Free", icon: Tag },
  { id: "lost_found", label: "Lost & found", badge: "Lost & found", hint: "Lost keys, a missing pet, found items", icon: Search },
  { id: "poll", label: "Poll", badge: "Poll", hint: "Ask neighbours to vote on something", icon: BarChart3 },
  { id: "thanks", label: "Thank a neighbour", badge: "Thanks", hint: "Shout out someone who made a difference", icon: HandHeart },
];

export function categoryDef(id: PostCategory): CategoryDef {
  return POST_CATEGORIES.find((c) => c.id === id) ?? POST_CATEGORIES[0]!;
}

// ── Alert categories (adapted for Nigeria — docs/product/nextdoor-research.md §13) ─

export interface AlertCategoryDef {
  id: AlertCategory;
  label: string;
  icon: LucideIcon;
  /** Token-based classes: soft background + strong foreground. */
  tone: string;
}

const DANGER = "bg-danger-soft text-destructive";
const WARNING = "bg-warning-soft text-warning";
const INFO = "bg-info-soft text-info";

export const ALERT_CATEGORIES: AlertCategoryDef[] = [
  { id: "security", label: "Security", icon: ShieldAlert, tone: DANGER },
  { id: "power", label: "Power", icon: Zap, tone: WARNING },
  { id: "water", label: "Water", icon: Droplets, tone: INFO },
  { id: "flooding", label: "Flooding", icon: Waves, tone: INFO },
  { id: "traffic", label: "Traffic", icon: Car, tone: WARNING },
  { id: "fire", label: "Fire", icon: Flame, tone: DANGER },
  { id: "scam", label: "Scam warning", icon: BadgeAlert, tone: DANGER },
  { id: "other", label: "Other", icon: AlertTriangle, tone: WARNING },
];

export function alertCategoryDef(id: AlertCategory | undefined): AlertCategoryDef {
  return ALERT_CATEGORIES.find((c) => c.id === id) ?? ALERT_CATEGORIES[ALERT_CATEGORIES.length - 1]!;
}

/** Urgent + still within the takeover window + not resolved (see features/alerts/lifecycle.ts). */
export function isUrgentAlert(post: Post, now = Date.now()): boolean {
  return post.meta.category === "alert" && alertStatus(post, now) === "urgent";
}

// ── Feed filters (?filter=…) ────────────────────────────────────────────────

export const FEED_FILTERS = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Alerts" },
  { id: "events", label: "Events" },
  { id: "for-sale", label: "For sale" },
  { id: "recommendations", label: "Recommendations" },
  { id: "general", label: "General" },
] as const;

export type FeedFilter = (typeof FEED_FILTERS)[number]["id"];

export function parseFeedFilter(raw: string | null): FeedFilter {
  return FEED_FILTERS.some((f) => f.id === raw) ? (raw as FeedFilter) : "all";
}

export function matchesFilter(post: Post, filter: FeedFilter): boolean {
  const c = post.meta.category;
  switch (filter) {
    case "all":
      return true;
    case "alerts":
      return c === "alert";
    case "events":
      return c === "event";
    case "for-sale":
      return c === "for_sale";
    case "recommendations":
      return c === "recommendation";
    case "general":
      return c === "general" || c === "lost_found" || c === "thanks" || c === "poll";
  }
}

// ── Reactions (Nextdoor set — deliberately no "Angry") ─────────────────────

export const REACTIONS: { id: ReactionType; emoji: string; label: string }[] = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "helpful", emoji: "🙌", label: "Helpful" },
  { id: "agree", emoji: "✅", label: "Agree" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
];

export function reactionDef(id: ReactionType) {
  return REACTIONS.find((r) => r.id === id) ?? REACTIONS[0]!;
}
