/**
 * Lightweight "Kindness Reminder" (Nextdoor found 36% of prompted neighbours
 * edit or withhold, cutting guideline violations ~15%). This is a gentle
 * nudge, not moderation — the server remains authoritative.
 * planned: POST /moderation/check { text } → { flagged, reasons }.
 */
const WORDS = [
  "idiot",
  "stupid",
  "fool",
  "useless",
  "shut up",
  "nonsense",
  "mumu",
  "werey",
  "ode",
  "olodo",
  "ashawo",
  "bastard",
  "ewu",
];

const PATTERN = new RegExp(`\\b(${WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

export function needsKindnessReminder(text: string): boolean {
  return PATTERN.test(text);
}
