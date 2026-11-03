/**
 * After someone says they're under 18, this browser won't offer sign-up or the age check again for
 * a while, so the answer isn't simply retried with an older year (a "neutral age gate"). It is a
 * speed bump, not a wall: clearing site data removes it. Stores only when it happened.
 */

const KEY = "myhoodora:age-lock";
export const AGE_LOCK_MS = 30 * 24 * 60 * 60 * 1000;

export function lockAgeCheck(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // Private mode or storage blocked: the account is closed on the server either way.
  }
}

export function ageCheckLocked(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && now - at < AGE_LOCK_MS;
  } catch {
    return false;
  }
}
