/**
 * Streaks (plan WP-C): consecutive days, Lagos time, on which someone posted, replied, voted in a poll
 * or answered an event. Humane on purpose (Duolingo's lesson, without the guilt): one missed day a week
 * is forgiven automatically, today still counts until midnight, and a tier steps down a level after a
 * break instead of vanishing.
 */
export type StreakTier = "bronze" | "silver" | "gold";
export const TIER_AT: Record<StreakTier, number> = { bronze: 3, silver: 7, gold: 30 };
const TIERS: StreakTier[] = ["bronze", "silver", "gold"];
/** A tier earned before a break is shown one level lower for this long. */
export const TIER_GRACE_DAYS = 7;

export function tierFor(days: number): StreakTier | null {
  return days >= TIER_AT.gold ? "gold" : days >= TIER_AT.silver ? "silver" : days >= TIER_AT.bronze ? "bronze" : null;
}

function stepDown(t: StreakTier | null): StreakTier | null {
  return t ? (TIERS[TIERS.indexOf(t) - 1] ?? null) : null;
}

/** "2026-11-17" for an instant, Lagos time (UTC+1, no daylight saving). */
export function lagosDay(at: Date): string {
  return new Date(at.getTime() + 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the day's week: the forgiven day is one per Monday–Sunday week. */
function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface StreakResult {
  current: number;
  best: number;
  /** The last day they were active, if any. */
  lastDay: string | null;
  activeToday: boolean;
  /** What their avatar shows: today's streak's tier, or one lower for a week after a break. */
  tier: StreakTier | null;
  /** Days to the next tier, null at gold. */
  toNextTier: number | null;
}

/** Runs of active days, oldest first, each allowed one missed day per week inside it. */
function runs(days: string[]): { start: string; end: string; length: number }[] {
  const out: { start: string; end: string; length: number }[] = [];
  let cur: { start: string; end: string; length: number; forgiven: Set<string> } | null = null;
  for (const day of days) {
    if (cur) {
      const gap = daysBetween(cur.end, day);
      if (gap === 1) {
        cur.end = day;
        cur.length++;
        continue;
      }
      // One missed day, and the week's free day not used yet: the run goes on.
      const missed = addDays(cur.end, 1);
      if (gap === 2 && !cur.forgiven.has(weekOf(missed))) {
        cur.forgiven.add(weekOf(missed));
        cur.end = day;
        cur.length++;
        continue;
      }
      out.push({ start: cur.start, end: cur.end, length: cur.length });
    }
    cur = { start: day, end: day, length: 1, forgiven: new Set() };
  }
  if (cur) out.push({ start: cur.start, end: cur.end, length: cur.length });
  return out;
}

/** `days`: the Lagos days they were active (any order, repeats fine). `today`: lagosDay(now). */
export function computeStreak(days: Iterable<string>, today: string): StreakResult {
  const sorted = [...new Set(days)].filter((d) => d <= today).sort();
  const all = runs(sorted);
  const last = all[all.length - 1];
  const best = all.reduce((m, r) => Math.max(m, r.length), 0);
  const lastDay = sorted[sorted.length - 1] ?? null;
  // Still running: active today, yesterday (today isn't over), or the day before with the week's free day.
  const sinceLast = last ? daysBetween(last.end, today) : Infinity;
  const alive = last && (sinceLast <= 1 || (sinceLast === 2 && !forgivenIn(sorted, last, addDays(last.end, 1))));
  const current = alive ? last!.length : 0;
  let tier = tierFor(current);
  if (!tier && last && sinceLast <= TIER_GRACE_DAYS) tier = stepDown(tierFor(last.length));
  const next = TIERS.find((t) => TIER_AT[t] > current);
  return { current, best, lastDay, activeToday: lastDay === today, tier, toNextTier: next ? TIER_AT[next] - current : null };
}

/** Whether the run already used the free day of the week `missed` falls in. */
function forgivenIn(sorted: string[], run: { start: string; end: string }, missed: string): boolean {
  const week = weekOf(missed);
  const inRun = sorted.filter((d) => d >= run.start && d <= run.end);
  for (let i = 1; i < inRun.length; i++) if (daysBetween(inRun[i - 1]!, inRun[i]!) === 2 && weekOf(addDays(inRun[i - 1]!, 1)) === week) return true;
  return false;
}
