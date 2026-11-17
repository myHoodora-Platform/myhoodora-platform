/**
 * When Hood Team posts go out (docs/product/hood-activation-plan.md §7). Pure functions; all times
 * are Lagos time (WAT, UTC+1 all year: Nigeria has no daylight saving).
 */

const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Lagos calendar date of a moment, as YYYY-MM-DD. */
export function watDate(at: Date): string {
  return new Date(at.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Lagos hour (0–23) of a moment. */
export function watHour(at: Date): number {
  return new Date(at.getTime() + WAT_OFFSET_MS).getUTCHours();
}

/** The moment it is `HH:MM` Lagos time on a YYYY-MM-DD Lagos date. */
export function atWat(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.parse(`${date}T00:00:00Z`) - WAT_OFFSET_MS + ((h ?? 0) * 60 + (m ?? 0)) * 60_000);
}

/** The YYYY-MM-DD date `days` after another. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6, for a YYYY-MM-DD date. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export interface PlanStep {
  /** Days after the plan starts (0 = the first day). */
  day: number;
  /** Lagos time, HH:MM. */
  time: string;
  /** Content bank code (docs/product/hood-content-bank.md). */
  code: string;
}

/**
 * A new Hood's first ten days: the welcome post first (pinned), then a mix of starters, local
 * information and polls, morning and evening, so the Hood looks naturally active instead of having
 * everything appear at once. Info items still waiting for local details are skipped per Hood.
 */
export const DEFAULT_ACTIVATION_PLAN: readonly PlanStep[] = [
  { day: 0, time: "08:00", code: "W01" },
  { day: 0, time: "18:00", code: "I01" },
  { day: 1, time: "08:00", code: "S01" },
  { day: 1, time: "18:00", code: "S26" },
  { day: 2, time: "08:00", code: "I06" },
  { day: 2, time: "18:00", code: "S11" },
  { day: 3, time: "08:00", code: "S36" },
  { day: 3, time: "18:00", code: "S31" },
  { day: 4, time: "08:00", code: "I10" },
  { day: 4, time: "18:00", code: "S46" },
  { day: 5, time: "08:00", code: "S12" },
  { day: 5, time: "18:00", code: "S51" },
  { day: 6, time: "08:00", code: "S41" },
  { day: 6, time: "18:00", code: "S49" },
  { day: 7, time: "08:00", code: "I23" },
  { day: 7, time: "18:00", code: "S06" },
  { day: 8, time: "18:00", code: "I24" },
  { day: 9, time: "18:00", code: "S60" },
];

/**
 * Today's daily prompt when nobody chose one: the bank's daily items in code order, read as weeks
 * that start on Monday (D01 is a Monday item), so the weekday themes line up. Items beyond whole
 * weeks are spares, used only when picked by hand.
 */
export function rotationPick(dailyCodes: readonly string[], date: string, anchor = "2026-11-16"): string | null {
  const ordered = [...dailyCodes].sort();
  const weeks = Math.floor(ordered.length / 7);
  if (weeks === 0) return ordered[0] ?? null;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / DAY_MS);
  const week = (((Math.floor(days / 7) % weeks) + weeks) % weeks);
  return ordered[week * 7 + weekdayIndex(date)] ?? null;
}
