/**
 * The age check (docs/compliance/ndpa.md §1). myHoodora is for adults: under the NDPA (s.31) a
 * child is anyone under 18, and we don't take a child's data at all rather than run a parental
 * consent flow. Everyone is asked when they were born once, before onboarding, whichever way they
 * signed up: the year, and the month and day only when the year can't settle it. The API works the
 * age out and keeps only that they passed: never the year or the date.
 *
 * Shared so the web, the app and the API can never disagree about who is old enough.
 */

import type { UserProfile } from "./types";

export const MIN_AGE = 18;

/** Older than anyone alive: a birth year before this is a typo, not an answer. */
const MAX_AGE = 120;

export interface BirthDate {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
}

/** "2001-04-09", the shape the API accepts. */
export function formatBirthDate({ year, month, day }: BirthDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A real calendar date in "YYYY-MM-DD", or null (31 February, a malformed string). */
export function parseBirthDate(value: string): BirthDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Whole years old on `today` (local calendar date: a birthday counts from the morning of it). */
export function ageOn(birth: BirthDate, today: Date = new Date()): number {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const hadBirthday = m > birth.month || (m === birth.month && d >= birth.day);
  return y - birth.year - (hadBirthday ? 0 : 1);
}

export type AgeCheck = { ok: true; adult: boolean } | { ok: false; problem: string };

/**
 * What a date of birth says: not a usable answer (with the reason to show), or old enough or not.
 * The wording never names the minimum age, so the form doesn't teach anyone which year to pick.
 */
export function checkBirthDate(value: string, today: Date = new Date()): AgeCheck {
  const birth = parseBirthDate(value);
  if (!birth) return { ok: false, problem: "Enter a real date: day, month and year." };
  const age = ageOn(birth, today);
  if (age < 0) return { ok: false, problem: "That date is in the future." };
  if (age > MAX_AGE) return { ok: false, problem: "Check the year: it looks too far back." };
  return { ok: true, adult: age >= MIN_AGE };
}

/**
 * Year first (docs/compliance/ndpa.md §1): most people are clearly over or under from the year alone,
 * so that's all we ask. Only someone born exactly MIN_AGE years ago may or may not have had the
 * birthday yet, so only they are asked the month and day too.
 */
export interface BirthAnswer {
  year: number;
  /** 1–12; only asked when the year alone can't settle it. */
  month?: number;
  day?: number;
}

export type BirthAnswerCheck =
  | { kind: "answer"; adult: boolean }
  /** The year sits on the line: ask the month and day. */
  | { kind: "needs_date" }
  | { kind: "invalid"; problem: string };

/** True when the year alone can't say whether someone is old enough (they turn MIN_AGE this year). */
export function needsFullDate(year: number, today: Date = new Date()): boolean {
  return today.getFullYear() - year === MIN_AGE;
}

/** "1995", or "2008-04-09" when the month and day were asked: the shapes the API accepts. */
export function formatBirthAnswer({ year, month, day }: BirthAnswer): string {
  return month && day ? formatBirthDate({ year, month, day }) : String(year).padStart(4, "0");
}

/** What an answer says. The wording never names the minimum age, as with checkBirthDate. */
export function checkBirthAnswer(answer: BirthAnswer, today: Date = new Date()): BirthAnswerCheck {
  const { year, month, day } = answer;
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return { kind: "invalid", problem: "Enter the year you were born, like 1990." };
  const span = today.getFullYear() - year;
  if (span < 0) return { kind: "invalid", problem: "That year is in the future." };
  if (span > MAX_AGE) return { kind: "invalid", problem: "Check the year: it looks too far back." };
  if (span !== MIN_AGE) return { kind: "answer", adult: span > MIN_AGE };
  if (!month || !day) return { kind: "needs_date" };
  const check = checkBirthDate(formatBirthDate({ year, month, day }), today);
  return check.ok ? { kind: "answer", adult: check.adult } : { kind: "invalid", problem: check.problem };
}

export type BirthInputRead = { ok: true; value: string; adult: boolean } | { ok: false; problem: string };

/**
 * The form as typed (strings, the month and day empty until they're asked) → what to send, or the
 * problem to show. Both clients use this, so they ask for the same thing in the same words.
 */
export function readBirthInput(input: { year: string; month?: string; day?: string }, today: Date = new Date()): BirthInputRead {
  const year = input.year.trim();
  if (!year) return { ok: false, problem: "Enter the year you were born." };
  if (!/^\d{4}$/.test(year)) return { ok: false, problem: "Enter the year you were born, like 1990." };
  const answer: BirthAnswer = { year: Number(year), month: Number(input.month) || undefined, day: Number(input.day) || undefined };
  const check = checkBirthAnswer(answer, today);
  if (check.kind === "invalid") return { ok: false, problem: check.problem };
  if (check.kind === "needs_date") return { ok: false, problem: "Add the day and month you were born too." };
  return { ok: true, value: formatBirthAnswer(answer), adult: check.adult };
}

/** "1995", or "9 April 2008": the answer read back before it's sent. */
export function spokenBirthAnswer(value: string): string {
  const full = parseBirthDate(value);
  return full ? `${full.day} ${MONTHS[full.month - 1]} ${full.year}` : value;
}

/** The months, for the month picker. */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** Days in a month (February in a leap year has 29). For the day picker; 31 when the year isn't chosen yet. */
export function daysInMonth(month: number, year?: number): number {
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

/**
 * POST /users/me/age with `birthDate`: "YYYY", or "YYYY-MM-DD" for someone born MIN_AGE years ago
 * (a bare year then answers 400). Old enough: the updated profile. Not: the account has been closed and is
 * being deleted, and the client signs out and shows the "can't join yet" screen.
 */
export type AgeCheckResponse = { adult: true; profile: UserProfile } | { adult: false };
