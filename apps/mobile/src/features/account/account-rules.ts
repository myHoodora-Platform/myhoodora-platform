import { BIO_MAX, DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@myhoodora/api-contract/settings";

/** The API's rules for a name and a bio (PATCH /users/me), checked before sending. */
export function profileErrors(name: string, bio: string): { name?: string; bio?: string } | null {
  const e: { name?: string; bio?: string } = {};
  const n = name.trim();
  if (n.length < DISPLAY_NAME_MIN) e.name = `Your name needs at least ${DISPLAY_NAME_MIN} characters.`;
  else if (n.length > DISPLAY_NAME_MAX) e.name = `Keep your name to ${DISPLAY_NAME_MAX} characters.`;
  if (bio.trim().length > BIO_MAX) e.bio = `Keep it to ${BIO_MAX} characters.`;
  return Object.keys(e).length ? e : null;
}

/** Whether this person may change their email: unconfirmed, and signed in with a password (contract §31). */
export function canChangeEmail(profile: { emailVerified?: boolean } | null, providers: string[]): boolean {
  return profile?.emailVerified === false && providers.includes("password");
}

/** The API's bounds for a reason (contract §31). */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function reasonProblem(reason: string): string | null {
  const r = reason.trim();
  if (r.length < REASON_MIN) return `Tell us why in at least ${REASON_MIN} characters.`;
  if (r.length > REASON_MAX) return `Keep it to ${REASON_MAX} characters.`;
  return null;
}

/**
 * Open neighbourhoods you could ask to follow: not home, not followed, not already asked for. Grouped
 * by city, your own city first (where people most often work or have family), then A to Z.
 */
export function followable<T extends { _id: string; name: string; city: string }>(all: T[], exclude: Set<string>, query: string, homeCity?: string): { city: string; hoods: T[] }[] {
  const q = query.trim().toLowerCase();
  const left = all.filter((h) => !exclude.has(h._id) && (!q || h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)));
  const byCity = new Map<string, T[]>();
  for (const h of left) byCity.set(h.city, [...(byCity.get(h.city) ?? []), h]);
  const rank = (city: string) => (city === homeCity ? 0 : 1);
  return [...byCity]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([city, hoods]) => ({ city, hoods: hoods.sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** One-tap starting points for a reason; the person can edit them. */
export const REASON_SUGGESTIONS = ["I work there", "My family lives there", "I run a business there", "I'm there most weekends", "My children go to school there"];
