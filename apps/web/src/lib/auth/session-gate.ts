import { API_BASE_URL } from "@/lib/api/config";

/**
 * What the API says about a session cookie, for the page gate (src/proxy.ts).
 *
 * The proxy can check a cookie's signature and expiry by itself, but only
 * Firebase knows whether the session behind it has been revoked (signed out
 * everywhere, password changed, account disabled) and only our database
 * knows who is staff. The two API routes below are the only ones that take
 * the session cookie; both verify it with the Admin SDK, revocation included.
 *
 * Answers are remembered briefly per server instance, so the gate costs one
 * API call a minute per session, not one per navigation. That minute is also
 * the longest a revoked session keeps being served pages (never data: every
 * API call checks revocation itself).
 */
export type SessionVerdict = "live" | "revoked" | "unknown";
export type StaffVerdict = "staff" | "not_staff" | "expired" | "unknown";

const LIVE_TTL_MS = 60_000;
// The API can't be reached: don't make every navigation wait out the timeout.
const UNKNOWN_TTL_MS = 10_000;
const TIMEOUT_MS = 5_000;
const MAX_ENTRIES = 5_000;
// route + session cookie hash → verdict.
const cache = new Map<string, { verdict: string; until: number }>();
// …and → the question currently being asked. A page load is several requests
// at once (the document, its data, prefetches): they share one API call,
// which matters most on a server instance that has just started.
const asking = new Map<string, Promise<string>>();

async function cookieKey(sessionCookie: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionCookie));
  return Buffer.from(digest).toString("base64url");
}

async function ask<V extends string>(
  route: string,
  sessionCookie: string,
  toVerdict: (status: number | null) => V,
  keepMs: Partial<Record<V, number>>,
): Promise<V> {
  const key = `${route}:${await cookieKey(sessionCookie)}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.until) return hit.verdict as V;
  cache.delete(key);

  const active = asking.get(key);
  if (active) return active as Promise<V>;

  const question = (async () => {
    let status: number | null = null;
    try {
      const res = await fetch(`${API_BASE_URL}${route}`, {
        headers: { Authorization: `Bearer ${sessionCookie}` },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
    } catch {
      // Unreachable or timed out: `status` stays null.
    }

    const verdict = toVerdict(status);
    const ttl = keepMs[verdict];
    if (ttl) {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(key, { verdict, until: Date.now() + ttl });
    }
    return verdict;
  })().finally(() => asking.delete(key));
  asking.set(key, question);
  return question;
}

/**
 * Is the session still live? "revoked" is never remembered (it is final, and
 * the proxy deletes the cookie). "unknown" (API down, rate-limited) lets the
 * page load: the app shows its own "can't reach myHoodora" state, which beats
 * signing everyone out whenever the API restarts.
 */
export function sessionVerdict(sessionCookie: string): Promise<SessionVerdict> {
  return ask(
    "/auth/session",
    sessionCookie,
    (status) => (status === 204 ? "live" : status === 401 ? "revoked" : "unknown"),
    { live: LIVE_TTL_MS, unknown: UNKNOWN_TTL_MS },
  );
}

/**
 * The admin portal's gate. Only "staff" is remembered. Outages should be
 * retried, and "not staff" must not stick: someone just promoted from
 * Admin → Team gets in on their next page load. (A demoted user may keep the
 * page for up to a minute, but AdminShell re-checks /admin/me and the API
 * refuses every admin call at once.)
 */
export function staffVerdict(sessionCookie: string): Promise<StaffVerdict> {
  return ask(
    "/auth/session/staff",
    sessionCookie,
    (status) => (status === 204 ? "staff" : status === 403 ? "not_staff" : status === 401 ? "expired" : "unknown"),
    { staff: LIVE_TTL_MS },
  );
}
