/**
 * Remembering the shared post someone came in from, across sign-up and onboarding, so their feed
 * can offer it back ("You came from a Lekki post"); and opening that post in the app.
 */

import { readSavedInvite, rememberInviteRef } from "@/features/invites/invite-ref";

const KEY = "mh-shared-from";
/** Long enough to sign up and verify; short enough not to haunt them. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export const ANDROID_PACKAGE = "com.myhoodora.app";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export interface SharedVisit {
  postId: string;
  hoodName?: string;
  at: number;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Private mode or blocked storage: nothing to remember, nothing breaks.
  }
}

export function rememberSharedVisit(v: { postId: string; hoodName?: string; ref?: string }, now = Date.now()): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ postId: v.postId, hoodName: v.hoodName, at: now } satisfies SharedVisit));
    // The first invite code wins for 30 days (docs/product/hood-activation-plan.md §9).
    if (v.ref) rememberInviteRef(v.ref, "post", { now });
  } catch {
    // Storage full or blocked.
  }
}

export function readSharedVisit(now = Date.now()): SharedVisit | null {
  const s = store();
  const v = s ? readJson<SharedVisit>(s, KEY) : null;
  if (!v || typeof v.postId !== "string" || now - v.at > KEEP_MS) return null;
  return v;
}

export function clearSharedVisit(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** The invite code from a shared link, if one is still current (WP-E reads it at sign-up). */
export function readInviteRef(now = Date.now()): string | null {
  return readSavedInvite(now)?.code ?? null;
}

function readJson<T>(s: Storage, key: string): T | null {
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * A link that opens `path` (e.g. "p/<id>") in the app, or null where we can't do it reliably.
 * Android: an intent link with the Play Store as fallback (opens the app if installed, the store if
 * not). iPhone: not until the iOS app is live; then Universal Links take over (plan WP-H).
 */
export function openInAppHref(path: string, userAgent: string): string | null {
  if (!/Android/i.test(userAgent)) return null;
  const clean = path.replace(/^\/+/, "");
  return `intent://${clean}#Intent;scheme=myhoodora;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
}

/** Instagram's or Facebook's built-in browser, where links can't open apps by themselves. */
export function inAppBrowser(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|Snapchat/i.test(userAgent);
}
