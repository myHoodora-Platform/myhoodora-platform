/**
 * Rules the apps follow that admins set (Admin → Settings → Platform), from `GET /app-config`.
 */
export interface AppConfig {
  analytics: {
    /** Days before the app asks again someone who said no to usage analytics. 0: never asks again. */
    reaskDays: number;
  };
}

/**
 * The Privacy Policy version that last changed what app usage analytics collects or why. Raise it to
 * a new version's date when that version changes analytics: every phone is then asked again, whatever
 * it answered before, because they agreed (or not) to something else.
 */
export const ANALYTICS_POLICY_VERSION = "2026-11-07";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether to show the analytics question: never answered; answered under an older analytics policy;
 * or a no older than `reaskDays` (0 never re-asks). A yes is never asked again for time alone.
 */
export function shouldAskAnalytics(consent: { choice: "granted" | "denied"; at: string; policy: string } | null, reaskDays: number, now: Date): boolean {
  if (!consent) return true;
  if (consent.policy < ANALYTICS_POLICY_VERSION) return true;
  if (consent.choice === "granted" || reaskDays <= 0) return false;
  const at = Date.parse(consent.at);
  return Number.isFinite(at) && now.getTime() - at >= reaskDays * DAY_MS;
}
