import { NextRequest, NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { API_BASE_URL, USE_MOCKS } from "@/lib/api/config";
import {
  SESSION_COOKIE,
  VerifierUnavailableError,
  isSameOrigin,
  sessionCookieOptions,
  verifyIdToken,
  verifySessionCookie,
} from "@/lib/auth/session-cookie";

const MINT_TIMEOUT_MS = 10_000;

function reply(body: Record<string, string>, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function clearing(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}

const pastHalfLife = (claims: DecodedIdToken) => claims.exp - Math.floor(Date.now() / 1000) < (claims.exp - claims.iat) / 2;

type Minted = { sessionCookie: string; expiresIn: number } | "rejected" | "unavailable";

/** The API holds the Admin credentials: it re-verifies the ID token (including revocation) and mints the cookie. */
async function mintSessionCookie(idToken: string): Promise<Minted> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    });
    if (res.status === 401) return "rejected";
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { sessionCookie?: unknown; expiresIn?: unknown };
    if (typeof body.sessionCookie !== "string" || typeof body.expiresIn !== "number") return "unavailable";
    return { sessionCookie: body.sessionCookie, expiresIn: body.expiresIn };
  } catch {
    return "unavailable";
  }
}

/**
 * Brings the server session in line with the browser's Firebase sign-in:
 * `{ idToken }` in, HttpOnly session cookie out. Safe to call repeatedly:
 * a cookie from this same sign-in with more than half its life left is kept,
 * so most calls never leave this server.
 *
 * 200 the session is in place · 401 this sign-in isn't valid (cookie cleared)
 * · 503 couldn't reach the API (an existing valid cookie is kept), or couldn't
 * check the token at all (nothing is cleared: nothing is known to be wrong).
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);
  // Mock mode has no server session (see src/proxy.ts): nothing to mint or keep in step.
  if (USE_MOCKS) return reply({ status: "ok" }, 200);

  const body: unknown = await request.json().catch(() => null);
  const idToken = (body as { idToken?: unknown } | null)?.idToken;
  if (typeof idToken !== "string" || !idToken) return reply({ error: "Missing ID token" }, 400);

  let claims: DecodedIdToken | null;
  let current: DecodedIdToken | null;
  try {
    claims = await verifyIdToken(idToken);
    if (!claims) return clearing(reply({ error: "Invalid or expired ID token" }, 401));
    current = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    if (!(err instanceof VerifierUnavailableError)) throw err;
    // Google's signing keys can't be fetched, so nothing can be checked here.
    // Not a 401: the browser signs out of Firebase on that.
    return reply({ error: "Session service unavailable" }, 503);
  }
  const isTheirs = current?.uid === claims.uid;
  // Same person *and* same sign-in: a new sign-in always gets a new cookie, so
  // one left over from before a "sign out everywhere" is never carried along.
  const isThisSignIn = isTheirs && current!.auth_time === claims.auth_time;
  if (isThisSignIn && !pastHalfLife(current!)) return reply({ status: "ok" }, 200);

  const minted = await mintSessionCookie(idToken);

  if (minted === "rejected") return clearing(reply({ error: "Invalid or expired ID token" }, 401));
  if (minted === "unavailable") {
    // Their own cookie is still good, it just couldn't be renewed. Someone else's must not stay.
    if (isTheirs) return reply({ status: "ok" }, 200);
    return clearing(reply({ error: "Session service unavailable" }, 503));
  }

  const response = reply({ status: "ok" }, 200);
  response.cookies.set(SESSION_COOKIE, minted.sessionCookie, sessionCookieOptions(minted.expiresIn));
  return response;
}
