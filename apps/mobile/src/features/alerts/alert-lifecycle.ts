import type { AlertCategory, ApiPost } from "@myhoodora/api-contract/types";

/**
 * How long an alert stays "active" (Nextdoor's yellow state), as on the web
 * (apps/web/src/features/alerts/lifecycle.ts). The API sends `activeUntil` on each alert (staff can
 * change the windows); these are the fallback for a post without one.
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

/** Urgent alerts lead for this long. */
export const URGENT_WINDOW_HOURS = 2;
/** The Alerts page keeps a week, like Nextdoor's alerts map. */
export const ALERT_HISTORY_DAYS = 7;

export type AlertStatus = "urgent" | "active" | "resolved" | "ended";

const HOUR = 3_600_000;
const age = (post: ApiPost, now: number) => (now - new Date(post.createdAt).getTime()) / HOUR;
const kindOf = (post: ApiPost): AlertCategory => post.alertCategory ?? "other";

export const isAlert = (post: ApiPost) => post.category === "alert";

export function alertStatus(post: ApiPost, now = Date.now()): AlertStatus {
  if (post.resolvedAt) return "resolved";
  if (post.urgent && age(post, now) < URGENT_WINDOW_HOURS) return "urgent";
  const until = post.activeUntil ? new Date(post.activeUntil).getTime() : NaN;
  if (!Number.isNaN(until)) return now < until ? "active" : "ended";
  return age(post, now) < ALERT_ACTIVE_HOURS[kindOf(post)] ? "active" : "ended";
}

export function isActiveAlert(post: ApiPost, now = Date.now()): boolean {
  if (!isAlert(post)) return false;
  const s = alertStatus(post, now);
  return s === "urgent" || s === "active";
}

export const isRecentAlert = (post: ApiPost, now = Date.now()) => isAlert(post) && age(post, now) < ALERT_HISTORY_DAYS * 24;

/** Urgent first, then newest; ended and resolved alerts go to "Earlier this week". */
export function splitAlerts(posts: ApiPost[], now = Date.now()): { active: ApiPost[]; earlier: ApiPost[] } {
  const rank: Record<AlertStatus, number> = { urgent: 0, active: 1, resolved: 2, ended: 2 };
  const recent = posts.filter((p) => isRecentAlert(p, now));
  return {
    active: recent
      .filter((p) => isActiveAlert(p, now))
      .sort((a, b) => rank[alertStatus(a, now)] - rank[alertStatus(b, now)] || b.createdAt.localeCompare(a.createdAt)),
    earlier: recent.filter((p) => !isActiveAlert(p, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export interface AlertGroup {
  category: AlertCategory;
  /** Newest first. */
  posts: ApiPost[];
  latest: ApiPost;
  urgent: boolean;
}

/**
 * Several reports of one kind (three neighbours posting about the same outage) collapse into one row,
 * urgent kinds first, then the most recent.
 */
export function groupActiveAlerts(posts: ApiPost[], now = Date.now()): AlertGroup[] {
  const byKind = new Map<AlertCategory, ApiPost[]>();
  for (const p of posts) {
    if (!isActiveAlert(p, now)) continue;
    byKind.set(kindOf(p), [...(byKind.get(kindOf(p)) ?? []), p]);
  }
  return [...byKind.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { category, posts: sorted, latest: sorted[0]!, urgent: sorted.some((p) => alertStatus(p, now) === "urgent") };
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.latest.createdAt.localeCompare(a.latest.createdAt));
}

/** Active alerts per kind, for the filter chips ("Power 2"). */
export function activeCounts(posts: ApiPost[], now = Date.now()): Partial<Record<AlertCategory | "all", number>> {
  const counts: Partial<Record<AlertCategory | "all", number>> = {};
  for (const p of posts) {
    if (!isActiveAlert(p, now)) continue;
    counts.all = (counts.all ?? 0) + 1;
    counts[kindOf(p)] = (counts[kindOf(p)] ?? 0) + 1;
  }
  return counts;
}
