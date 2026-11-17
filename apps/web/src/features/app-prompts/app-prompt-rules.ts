import { withInviteRef } from "@myhoodora/api-contract/invites";

export const ANDROID_PACKAGE = "com.myhoodora.app";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const BANNER_KEY = "mh-app-banner-closed";
const SHEET_KEY = "mh-app-sheet-closed";
const VISITS_KEY = "mh-visits";
/** A closed banner stays away this long. */
export const BANNER_AWAY_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export type Device = "android" | "ios" | "other";

export function deviceOf(userAgent: string): Device {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return "other";
}

/** Installed as a home-screen app, or inside our own app's web view: no prompts there. */
export function isStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || /myHoodora\//.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/** The app's path for a web page: the same for the shared pages, the feed for the rest. */
export function appPathFor(webPath: string): string {
  const path = webPath.split(/[?#]/)[0] ?? "/";
  if (/^\/(p|for-sale|g|i|profile)\/[^/]+\/?$/.test(path)) return path.replace(/^\//, "");
  return "news-feed";
}

/** Android: opens the same page in the app when installed, the Play Store (keeping the invite code) when not. */
export function androidOpenHref(webPath: string, inviteCode?: string | null): string {
  const store = inviteCode ? `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`ref=${inviteCode}`)}` : PLAY_STORE_URL;
  const path = withInviteRef(appPathFor(webPath), inviteCode);
  return `intent://${path}#Intent;scheme=myhoodora;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(store)};end`;
}

function readNumber(key: string, store: "local" | "session" = "local"): number {
  try {
    return Number((store === "local" ? window.localStorage : window.sessionStorage).getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string, store: "local" | "session" = "local"): void {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Blocked storage: prompts just show as if new.
  }
}

export function bannerClosedRecently(now = Date.now()): boolean {
  return now - readNumber(BANNER_KEY) < BANNER_AWAY_DAYS * DAY;
}
export const closeBanner = (now = Date.now()) => write(BANNER_KEY, String(now));

export function sheetClosedRecently(everyDays: number, now = Date.now()): boolean {
  return now - readNumber(SHEET_KEY) < everyDays * DAY;
}
export const closeSheet = (now = Date.now()) => write(SHEET_KEY, String(now));

/** Counts browser sessions (not page views): the sheet waits for the second one. Returns the count. */
export function countVisit(): number {
  if (readNumber("mh-visit-counted", "session")) return readNumber(VISITS_KEY);
  const n = readNumber(VISITS_KEY) + 1;
  write(VISITS_KEY, String(n));
  write("mh-visit-counted", "1", "session");
  return n;
}
