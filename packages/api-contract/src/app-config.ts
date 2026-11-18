/**
 * Rules the apps follow that admins set (Admin → Settings → Platform), from `GET /app-config` (public).
 */
export interface AppConfig {
  analytics: {
    /** Days before the app asks again someone who said no to usage analytics. 0: never asks again. */
    reaskDays: number;
  };
  links: {
    /** The AI Studio address while "myHoodora AI" links go there; null while they go to the website's /ai page. */
    hoodoraAiStudio: string | null;
  };
  /**
   * Which app store versions are current, per platform. Missing from an API older than this field:
   * the app then never prompts.
   */
  updates?: Record<AppPlatform, AppVersionRule>;
  /** The festive season on now or starting within a day (contract §41). Missing from older APIs. */
  season?: import("./seasons").Season | null;
  /** "Get the app" prompts on the mobile website (contract §43). Missing from older APIs: treat as on. */
  appPrompts?: AppPrompts;
}

/** Admin → Settings → Platform → App prompts. */
export interface AppPrompts {
  /** The slim "Open in the app" banner on phones. */
  banner: boolean;
  /** The one-off "Better in the app" sheet at good moments. */
  sheet: boolean;
  /** After someone closes the sheet, the days before it may show again. */
  sheetEveryDays: number;
}
export const DEFAULT_APP_PROMPTS: AppPrompts = { banner: true, sheet: true, sheetEveryDays: 7 };

export type AppPlatform = "android" | "ios";

/** Admin-set store versions for one platform (Admin → Settings → Platform → App updates). */
export interface AppVersionRule {
  /** The newest version in the store. Older installs see a "New version available" sheet they can skip. */
  latest: string;
  /** The oldest version that still works. Older installs see a blocking "Update required" screen. */
  minimum: string;
  /** The app's store page; null until the app is in that store, and then nobody is prompted. */
  storeUrl: string | null;
}

/** Store versions are plain "major.minor.patch" numbers, as in app.config.ts `version`. */
export const APP_VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/** Negative when a is older than b, 0 when equal, positive when newer. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export type StoreUpdateStatus = "required" | "available" | "none";

/**
 * What the app should say about the store: "required" below the minimum, "available" below the latest.
 * Says nothing when it can't be sure: no installed version, no rule, no store page, or a malformed version.
 */
export function storeUpdateStatus(installed: string | null | undefined, rule: AppVersionRule | null | undefined): StoreUpdateStatus {
  if (!installed || !rule?.storeUrl || !APP_VERSION_PATTERN.test(installed)) return "none";
  if (APP_VERSION_PATTERN.test(rule.minimum) && compareVersions(installed, rule.minimum) < 0) return "required";
  if (APP_VERSION_PATTERN.test(rule.latest) && compareVersions(installed, rule.latest) < 0) return "available";
  return "none";
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
