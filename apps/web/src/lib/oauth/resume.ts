import { isAuthorizePath } from "@myhoodora/api-contract/oauth";

/**
 * Coming back to "Continue to myHoodora AI" after a detour (docs/integrations/myhoodora-ai.md §4.1):
 * when /oauth/authorize sends someone to the age check, the terms or "Welcome back", it remembers
 * itself here, and that page returns to it when they're done instead of going to the feed.
 *
 * This tab only (sessionStorage), for 15 minutes, used once, and only ever the authorise page:
 * it can't be turned into a redirect anywhere else.
 */
const KEY = "myhoodora.oauth.resume";
const TTL_MS = 15 * 60_000;

export function rememberOAuthResume(path: string, now = Date.now()): void {
  if (!isAuthorizePath(path)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: now }));
  } catch {
    // Storage blocked: they land in the app instead, and can start again from myHoodora AI.
  }
}

/** The authorise page to return to, if one was remembered in the last 15 minutes. Forgets it either way. */
export function takeOAuthResume(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || now - at > TTL_MS || now < at) return null;
    return isAuthorizePath(path) && !path.includes("\\") ? path : null;
  } catch {
    return null;
  }
}
