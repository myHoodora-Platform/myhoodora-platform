/**
 * Which feedback prompt (if any) to show a neighbour right now, and whether to ask for a store review.
 * Pure, so the rules are tested without a database. The service gathers the facts.
 */

const DAY = 86_400_000;

export interface PromptRule {
  id: string;
  status: string;
  deleted: boolean;
  triggerType: "action" | "feature" | "open" | "manual";
  triggerKey?: string;
  triggerCount: number;
  hoodIds: string[];
  cities: string[];
  minDaysSinceJoin?: number | null;
  maxDaysSinceJoin?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sentAt?: Date | null;
  priority: number;
  maxShows: number;
}

export interface Neighbour {
  joinedAt: Date;
  hoodId?: string | null;
  city?: string;
  /** When they were last shown any prompt. */
  lastPromptAt?: Date | null;
  /** Prompts they've answered. */
  answered: Set<string>;
  /** Times each prompt has been shown to them. */
  shows: Map<string, number>;
}

export interface Signal {
  key: string;
  /** How many times they've now done it, this one included. */
  count: number;
}

/** Whether this rule fires for this signal (an action/feature at its count, or the app opening). */
export function matchesTrigger(p: PromptRule, s: Signal): boolean {
  if (p.triggerType === "open" || p.triggerType === "manual") return s.key === "app_open";
  // At the Nth time, or later if it couldn't show then (cooldown): still "after the Nth time".
  return p.triggerKey === s.key && s.count >= p.triggerCount;
}

export function inAudience(p: PromptRule, n: Neighbour, now: Date): boolean {
  const aimed = p.hoodIds.length || p.cities.length;
  if (aimed && !((n.hoodId && p.hoodIds.includes(n.hoodId)) || (n.city && p.cities.includes(n.city)))) return false;
  const days = (now.getTime() - n.joinedAt.getTime()) / DAY;
  if (p.minDaysSinceJoin != null && days < p.minDaysSinceJoin) return false;
  if (p.maxDaysSinceJoin != null && days > p.maxDaysSinceJoin) return false;
  return true;
}

export function isLive(p: PromptRule, now: Date): boolean {
  if (p.deleted || p.status !== "active") return false;
  if (p.startsAt && p.startsAt > now) return false;
  if (p.endsAt && p.endsAt <= now) return false;
  // A manual prompt shows only once it has been sent.
  if (p.triggerType === "manual" && (!p.sentAt || p.sentAt > now)) return false;
  return true;
}

/**
 * The prompt to show, or null: live, triggered by this signal, for them, not answered, not shown too
 * often, and not within the cooldown since their last prompt (a prompt an admin sent by hand skips the
 * cooldown: it was asked for on purpose). Highest priority first, then the oldest.
 */
export function pickPrompt<P extends PromptRule>(rules: P[], n: Neighbour, s: Signal, opts: { now: Date; cooldownDays: number }): P | null {
  const cooling = !!n.lastPromptAt && opts.now.getTime() - n.lastPromptAt.getTime() < opts.cooldownDays * DAY;
  const open = rules.filter(
    (p) =>
      isLive(p, opts.now) &&
      matchesTrigger(p, s) &&
      inAudience(p, n, opts.now) &&
      !n.answered.has(p.id) &&
      (n.shows.get(p.id) ?? 0) < p.maxShows &&
      (!cooling || p.triggerType === "manual"),
  );
  open.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  return open[0] ?? null;
}

export interface StoreReviewRules {
  enabled: boolean;
  milestones: { key: string; count: number }[];
  minDaysSinceJoin: number;
  cooldownDays: number;
}

/**
 * Ask for an App Store / Play Store review now? Only at a milestone exactly (the 5th post, not every
 * post after it), once they've been around a while, and rarely. The stores cap it further themselves.
 */
export function shouldAskStoreReview(rules: StoreReviewRules, n: { joinedAt: Date; lastAskedAt?: Date | null }, s: Signal, now: Date): boolean {
  if (!rules.enabled) return false;
  if (!rules.milestones.some((m) => m.key === s.key && m.count === s.count)) return false;
  if ((now.getTime() - n.joinedAt.getTime()) / DAY < rules.minDaysSinceJoin) return false;
  if (n.lastAskedAt && now.getTime() - n.lastAskedAt.getTime() < rules.cooldownDays * DAY) return false;
  return true;
}
