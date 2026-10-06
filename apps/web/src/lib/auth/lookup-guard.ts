import { NextResponse, type NextRequest } from "next/server";
import { USE_MOCKS } from "@/lib/api/config";
import { SESSION_COOKIE, VerifierUnavailableError, verifySessionCookie } from "@/lib/auth/session-cookie";

/**
 * The gate for this server's own lookup routes (/api/geocode, /api/reverse-geocode,
 * /api/ip-location). Each one spends a third-party quota on the caller's behalf, and the proxy
 * does not cover `/api/*`, so without this anyone on the internet could spend it.
 *
 * Signed-in visitors only, and each of them only so often. The limit is per person, not per IP:
 * neighbours behind one mobile-carrier or estate address must not use up each other's allowance.
 *
 * The counters live in this server instance's memory. On a host that runs several instances (or
 * starts a new one per request) the real allowance is that many times larger, so this bounds
 * abuse by one account; it is not an exact quota.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_TRACKED = 10_000;

const windows = new Map<string, { count: number; resetAt: number }>();

function overLimit(key: string, now: number): number | null {
  const current = windows.get(key);
  if (!current || now >= current.resetAt) {
    if (windows.size >= MAX_TRACKED) {
      // Drop what has expired; if that isn't enough, the oldest entry goes (Map keeps insertion order).
      for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
      if (windows.size >= MAX_TRACKED) windows.delete(windows.keys().next().value!);
    }
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  current.count += 1;
  return current.count > MAX_PER_WINDOW ? Math.ceil((current.resetAt - now) / 1000) : null;
}

function refuse(status: number, error: string, headers?: Record<string, string>): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Null when the request may go ahead; otherwise the response to send instead:
 * 401 not signed in · 429 too many lookups (with Retry-After) · 503 the session couldn't be checked.
 */
export async function guardLookup(request: NextRequest, route: string): Promise<NextResponse | null> {
  let who: string;
  if (USE_MOCKS) {
    // Mock mode has no server session (see src/proxy.ts), so there is nobody to name: count by address.
    who = `ip:${clientIp(request)}`;
  } else {
    try {
      const claims = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
      if (!claims) return refuse(401, "Sign in to continue.");
      who = `uid:${claims.uid}`;
    } catch (err) {
      if (!(err instanceof VerifierUnavailableError)) throw err;
      // We can't tell who this is right now. The quota stays protected; the page asks again later.
      return refuse(503, "Please try again in a moment.");
    }
  }
  const retryAfter = overLimit(`${route}:${who}`, Date.now());
  return retryAfter === null ? null : refuse(429, "Too many lookups. Please wait a moment and try again.", { "Retry-After": String(retryAfter) });
}

/** For tests: forget every counter. */
export function resetLookupLimits(): void {
  windows.clear();
}
