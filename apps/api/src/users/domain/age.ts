/**
 * The age check (docs/compliance/ndpa.md §1). Mirrors packages/api-contract/src/age.ts, which the
 * web and the app use to check the form: the two must agree on MIN_AGE and on how an age is counted.
 */

export const MIN_AGE = 18;
const MAX_AGE = 120;

/**
 * Whole years old on `today`, from "YYYY-MM-DD"; null when it isn't a real date, is in the future
 * or is implausibly far back. Counted on the calendar in Lagos, where the person is.
 */
export function ageFromBirthDate(value: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  // West Africa Time is UTC+1 all year: a birthday starts at midnight there, not on the server's clock.
  const lagos = new Date(today.getTime() + 60 * 60 * 1000);
  const [ty, tm, td] = [lagos.getUTCFullYear(), lagos.getUTCMonth() + 1, lagos.getUTCDate()];
  const age = ty - year - (tm > month || (tm === month && td >= day) ? 0 : 1);
  return age < 0 || age > MAX_AGE ? null : age;
}

export type AgeVerdict = "adult" | "child" | "needs_date" | null;

/**
 * The age check's answer: "YYYY", or "YYYY-MM-DD" when the year alone can't settle it (born MIN_AGE
 * years ago, so it depends on whether the birthday has passed). null when it isn't a usable answer.
 * Year first, like packages/api-contract/src/age.ts `checkBirthAnswer`.
 */
export function ageVerdict(value: string, today: Date = new Date()): AgeVerdict {
  const v = value.trim();
  if (/^\d{4}$/.test(v)) {
    const span = new Date(today.getTime() + 60 * 60 * 1000).getUTCFullYear() - Number(v);
    if (span < 0 || span > MAX_AGE) return null;
    if (span === MIN_AGE) return "needs_date";
    return span > MIN_AGE ? "adult" : "child";
  }
  const age = ageFromBirthDate(v, today);
  if (age === null) return null;
  return age >= MIN_AGE ? "adult" : "child";
}
