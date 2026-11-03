/**
 * Kindness Reminder check (contract §12): a gentle nudge shown before
 * posting, not moderation. Nextdoor found about a third of prompted
 * neighbours edit or withhold. Pure and stateless: the text isn't stored.
 */

export const KINDNESS_REASONS = ["insult", "threat", "shouting"] as const;
export type KindnessReason = (typeof KINDNESS_REASONS)[number];

export interface KindnessResult {
  flagged: boolean;
  reasons: KindnessReason[];
}

/** Name-calling, English and common Nigerian (Pidgin, Yoruba, Igbo) terms. */
const INSULTS = [
  "idiot",
  "stupid",
  "fool",
  "foolish",
  "useless",
  "shut up",
  "nonsense",
  "senseless",
  "moron",
  "dumb",
  "bastard",
  "mumu",
  "werey",
  "ode",
  "olodo",
  "ashawo",
  "ewu",
  "oloshi",
  "ofe mmanu",
  "onye nzuzu",
];

/** First-person threats ("I will deal with you"), not reports of crime ("robbers threatened to kill"). */
const THREAT = /\b(i|we)\s*(will|'ll|go|dey go)\s+(kill|beat|deal with|finish|burn|slap|stab|shoot)\b/i;
const INSULT = new RegExp(`\\b(${INSULTS.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

/** Mostly capital letters over a meaningful length reads as shouting. */
function isShouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 20) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.8;
}

export function checkKindness(text: string): KindnessResult {
  const reasons: KindnessReason[] = [];
  if (INSULT.test(text)) reasons.push("insult");
  if (THREAT.test(text)) reasons.push("threat");
  if (isShouting(text)) reasons.push("shouting");
  return { flagged: reasons.length > 0, reasons };
}
