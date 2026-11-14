/**
 * "Continue as …" on the authorise page (docs/integrations/myhoodora-ai.md §4.1): before anything goes
 * to myHoodora AI, the person confirms the signed-in account is theirs, in case someone else signed in
 * to myHoodora on this device. Remembered for this sign-in only (its `state`), in this tab, for 15
 * minutes, so coming back from the age check, the terms or "Welcome back" doesn't ask twice.
 */
const KEY = "myhoodora.oauth.confirmed";
const TTL_MS = 15 * 60_000;

export function rememberAccountConfirmed(
  state: string | undefined,
  uid: string,
  now = Date.now(),
): void {
  if (!state) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ state, uid, at: now }));
  } catch {
    // Storage blocked: they're asked again after a detour, which is harmless.
  }
}

/** Whether this account already confirmed this sign-in (same `state`, same account, in the last 15 minutes). */
export function accountConfirmed(
  state: string | undefined,
  uid: string,
  now = Date.now(),
): boolean {
  if (!state) return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as {
      state?: unknown;
      uid?: unknown;
      at?: unknown;
    };
    return (
      saved.state === state &&
      saved.uid === uid &&
      typeof saved.at === "number" &&
      now >= saved.at &&
      now - saved.at <= TTL_MS
    );
  } catch {
    return false;
  }
}

export function forgetAccountConfirmed(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
