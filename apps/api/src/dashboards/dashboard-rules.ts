/**
 * When a Hood counts as activated, and what the challenge's numbers say to do
 * (docs/product/hood-activation-plan.md §3 and §4). Pure, so they're easy to check and to change.
 */
export const ACTIVATED = { items: 15, neighbours: 5, leads: 1 } as const;

export interface HoodReadiness {
  items: number;
  neighbours: number;
  leads: number;
  welcome: boolean;
  moderator: boolean;
}

export type Light = "green" | "amber" | "red";

/** Green: every box ticked. Amber: has people and some life. Red: nearly empty. */
export function readiness(h: HoodReadiness): { light: Light; missing: string[] } {
  const missing = [
    h.items < ACTIVATED.items ? `${ACTIVATED.items - h.items} more posts` : null,
    h.neighbours < ACTIVATED.neighbours ? `${ACTIVATED.neighbours - h.neighbours} more verified neighbours` : null,
    h.leads < ACTIVATED.leads ? "a Hood Lead" : null,
    h.welcome ? null : "a welcome post",
    h.moderator ? null : "a moderator",
  ].filter((m): m is string => Boolean(m));
  if (!missing.length) return { light: "green", missing };
  const alive = h.neighbours >= ACTIVATED.neighbours || h.items >= 5;
  return { light: alive ? "amber" : "red", missing };
}

export type ChallengeAdvice = "keep_going" | "push_harder" | "consider_ending";

/**
 * The plan's rules: keep going while sign-ups from invites grow; push harder where Hoods are red; consider
 * ending once growth has been flat or falling two weeks running, or most target Hoods are activated.
 * `weekly`: verified sign-ups from invites per week, oldest first (the current week last).
 */
export function challengeAdvice(weekly: number[], activatedShare: number, redShare: number): { advice: ChallengeAdvice; why: string } {
  const done = weekly.slice(0, -1); // the current week isn't over
  const [a, b, c] = done.slice(-3);
  const falling = done.length >= 3 && b! <= a! && c! <= b!;
  if (activatedShare >= 0.8) return { advice: "consider_ending", why: "At least 80% of Hoods are activated." };
  if (falling) return { advice: "consider_ending", why: "Sign-ups from invites haven't grown for two weeks running." };
  if (redShare >= 0.3) return { advice: "push_harder", why: "Many Hoods are still nearly empty: more prompts and Hood Leads there." };
  return { advice: "keep_going", why: "Sign-ups from invites are still growing." };
}
