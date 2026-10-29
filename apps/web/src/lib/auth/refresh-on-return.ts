/** Least time between profile reloads when a tab becomes visible again. */
export const RETURN_REFRESH_MS = 30_000;

/**
 * Coming back to a tab reloads the profile: things change elsewhere (the email confirmed in another
 * tab, an address approved), and a live event may have been missed while the tab slept. Signed in
 * only, and not more than once per window.
 */
export function returnRefreshDue(signedIn: boolean, lastRefreshAt: number, now = Date.now()): boolean {
  return signedIn && now - lastRefreshAt >= RETURN_REFRESH_MS;
}
