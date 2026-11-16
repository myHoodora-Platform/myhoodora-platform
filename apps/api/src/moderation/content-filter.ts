/**
 * Content filter (App Store guideline 1.2: "a method for filtering objectionable material from being
 * posted"). Unlike the kindness reminder (a nudge the person can ignore), text that matches here is
 * refused by the API on every route where people write something others will see (`@AllowedText()`).
 *
 * Matching works on whole words, after the text and the terms are folded the same way: lower case, no
 * accents, common look-alike characters ("p0rn", "$hit"), letters repeated three or more times ("fuuuck"), and letters
 * spelled out with dots or spaces ("f.u.c.k"). Whole words keep innocent words that merely contain a
 * term ("Scunthorpe", "Essex") out of it. A term ending in "*" also matches longer words that start
 * with it ("fuck*" → "fucking").
 *
 * The built-in list is deliberately short and high-confidence: sexual content, slurs and the most
 * offensive swear words. Everyday swearing, local insults and anything Hood-specific are for admins to
 * add (Admin → Settings → Platform → Blocked words), with reports and moderation catching the rest.
 */

/** Refused everywhere, whatever admins add. */
export const BUILT_IN_BLOCKED_TERMS: readonly string[] = [
  // Sexual content and solicitation
  "porn*",
  "xxx",
  "nudes",
  "send nudes",
  "sex video*",
  "sextape*",
  "sex tape*",
  "blowjob*",
  "handjob*",
  "hookup for cash",
  "pay for sex",
  // The most offensive swear words
  "cunt*",
  "motherfuck*",
  // Slurs
  "nigger*",
  "nigga*",
  "faggot*",
  "fag",
  "fags",
  "retard",
  "retards",
  "tranny",
  "trannies",
];

/** First-person threats to kill or maim someone ("I go kill you"), never reports of crime. */
// Not "shoot" or "burn": "I'll shoot you a message", "I'll burn you a copy".
const KILL_THREAT = /\b(i|we)\s*(will|'?ll|go|dey go|gonna)\s+(kill|stab|butcher)\s+(you|u|una|am|him|her|them)\b/i;

export const MAX_BLOCKED_TERMS = 500;
export const MAX_BLOCKED_TERM_LENGTH = 60;

const LOOK_ALIKES: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "8": "b" };

/** Lower case, no accents, look-alikes replaced, repeated letters collapsed, everything else a space. */
export function foldText(text: string): string {
  let s = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Look-alikes only inside words ("p0rn", "$hit"), so prices and dates stay what they are.
  // "!" and "|" count only between other characters ("sh!t"), never as punctuation ("porn!!!").
  s = s.replace(/[a-z0-9@$]+(?:[!|]+[a-z0-9@$]+)*/g, (word) => (/[a-z]/.test(word) ? word.replace(/[01!|3457@$8]/g, (c) => LOOK_ALIKES[c] ?? c) : word));
  // "f.u.c.k" / "f u c k" → "fuck": three or more single letters separated by a dot, dash, star or space.
  s = s.replace(/\b[a-z](?:[\s.*_-][a-z]\b){2,}/g, (m) => m.replace(/[\s.*_-]/g, ""));
  s = s.replace(/[^a-z0-9]+/g, " ");
  // Three or more of a letter ("fuuuck") become one. Doubles stay: "nigger" must never fold into "niger"
  // and match Niger or Nigeria.
  s = s.replace(/([a-z])\1{2,}/g, "$1");
  return ` ${s.trim()} `;
}

export interface CompiledTerms {
  pattern: RegExp | null;
}

/** One pattern for a list of terms (built-in plus admins'), each folded the same way as the text. */
export function compileTerms(terms: readonly string[]): CompiledTerms {
  const parts = new Set<string>();
  for (const raw of terms) {
    const prefix = raw.trim().endsWith("*");
    const folded = foldText(raw.replace(/\*+$/, "")).trim();
    if (folded.length < 2) continue;
    const escaped = folded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, " +");
    parts.add(prefix ? `${escaped}[a-z]*` : escaped);
  }
  if (parts.size === 0) return { pattern: null };
  return { pattern: new RegExp(` (?:${[...parts].join("|")}) `) };
}

let adminTerms: string[] = [];
let compiled = compileTerms(BUILT_IN_BLOCKED_TERMS);

/** Admins' extra terms (PlatformSettingsService keeps this current). */
export function setAdminBlockedTerms(terms: readonly string[]): void {
  const next = terms.map((t) => t.trim()).filter(Boolean);
  if (next.length === adminTerms.length && next.every((t, i) => t === adminTerms[i])) return;
  adminTerms = next;
  compiled = compileTerms([...BUILT_IN_BLOCKED_TERMS, ...adminTerms]);
}

/** Whether people may post this text. Empty text is always allowed (length rules are elsewhere). */
export function isAllowedText(text: string, terms: CompiledTerms = compiled): boolean {
  if (!text) return true;
  if (KILL_THREAT.test(text)) return false;
  if (!terms.pattern) return true;
  // Overlapping matches: the folded text has a space at each end, and every match needs one on both sides.
  const folded = foldText(text).replace(/ /g, "  ");
  return !terms.pattern.test(folded);
}

export const BLOCKED_TEXT_MESSAGE = "Please rephrase: this contains words that aren't allowed on myHoodora. See the Community Guidelines.";
