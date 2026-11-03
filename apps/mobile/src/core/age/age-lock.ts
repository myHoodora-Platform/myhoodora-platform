import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * After someone says they're under 18, this phone won't offer sign-up or the age check again for a
 * while, so the answer isn't simply retried with an older year (as on the web: age-lock.ts there).
 * A speed bump, not a wall: clearing the app's data removes it. Stores only when it happened.
 */

const KEY = "age.lock";
export const AGE_LOCK_MS = 30 * 24 * 60 * 60 * 1000;

/** Turned away in this run of the app: the welcome screen they land on says why, once. */
let turnedAwayNow = false;

/** True once, right after someone was turned away (then the welcome screen is back to normal). */
export function takeTurnedAway(): boolean {
  const was = turnedAwayNow;
  turnedAwayNow = false;
  return was;
}

export async function lockAgeCheck(now = Date.now()): Promise<void> {
  turnedAwayNow = true;
  // The account is closed on the server either way: never let this fail the flow.
  await AsyncStorage.setItem(KEY, String(now)).catch(() => undefined);
}

export async function ageCheckLocked(now = Date.now()): Promise<boolean> {
  try {
    const at = Number(await AsyncStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && now - at < AGE_LOCK_MS;
  } catch {
    return false;
  }
}

/**
 * The answer given in the email sign-up form, held in memory (never stored) until the new account
 * exists: the age check screen sends it straight away instead of asking again.
 */
let pendingAnswer: string | null = null;

export function rememberAgeAnswer(value: string): void {
  pendingAnswer = value;
}

/** The answer, if one is waiting. Read freely: it's only dropped by clearAgeAnswer, once it's sent. */
export function pendingAgeAnswer(): string | null {
  return pendingAnswer;
}

export function clearAgeAnswer(): void {
  pendingAnswer = null;
}
