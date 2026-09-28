import type { AlertCategory, Post } from "@/lib/api/types";

/**
 * How long an alert stays "active" (pinned in the feed's Active alerts card,
 * counted in badges) before it becomes an ordinary post. Tuned per type:
 * traffic clears fast, scams stay relevant for days.
 * planned: the API returns `activeUntil` so this lives server-side.
 */
export const ALERT_ACTIVE_HOURS: Record<AlertCategory, number> = {
  traffic: 3,
  fire: 6,
  security: 12,
  power: 12,
  flooding: 24,
  water: 24,
  other: 24,
  scam: 24 * 7,
};

/** Urgent alerts take over the app (red banner) for this long. */
export const URGENT_WINDOW_HOURS = 2;

/** The Alerts page keeps a week of history, like Nextdoor's alerts map. */
export const ALERT_HISTORY_DAYS = 7;

export type AlertStatus = "urgent" | "active" | "resolved" | "ended";

const HOUR = 3_600_000;

function ageHours(post: Post, now: number): number {
  return (now - new Date(post.createdAt).getTime()) / HOUR;
}

export function alertStatus(post: Post, now = Date.now()): AlertStatus {
  if (post.resolvedAt) return "resolved";
  const age = ageHours(post, now);
  if (post.meta.urgent && age < URGENT_WINDOW_HOURS) return "urgent";
  const window = ALERT_ACTIVE_HOURS[post.meta.alertCategory ?? "other"];
  return age < window ? "active" : "ended";
}

export function isAlert(post: Post): boolean {
  return post.meta.category === "alert";
}

export function isActiveAlert(post: Post, now = Date.now()): boolean {
  if (!isAlert(post)) return false;
  const s = alertStatus(post, now);
  return s === "urgent" || s === "active";
}

export function isRecentAlert(post: Post, now = Date.now()): boolean {
  return isAlert(post) && ageHours(post, now) < ALERT_HISTORY_DAYS * 24;
}

export interface AlertGroup {
  category: AlertCategory;
  posts: Post[]; // newest first
  latest: Post;
  urgent: boolean;
}

/**
 * Several reports of the same kind (e.g. three neighbours posting about the
 * power outage) collapse into one row — the "alert storm" grouping used by
 * monitoring and safety apps. Urgent groups first, then most recent.
 */
export function groupActiveAlerts(posts: Post[], now = Date.now()): AlertGroup[] {
  const byCategory = new Map<AlertCategory, Post[]>();
  for (const p of posts) {
    if (!isActiveAlert(p, now)) continue;
    const c = p.meta.alertCategory ?? "other";
    byCategory.set(c, [...(byCategory.get(c) ?? []), p]);
  }
  return [...byCategory.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        category,
        posts: sorted,
        latest: sorted[0]!,
        urgent: sorted.some((p) => alertStatus(p, now) === "urgent"),
      };
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.latest.createdAt.localeCompare(a.latest.createdAt));
}
