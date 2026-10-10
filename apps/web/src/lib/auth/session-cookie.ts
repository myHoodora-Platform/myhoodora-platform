import type { NextRequest } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

/**
 * The server-side session: a Firebase session cookie, minted by the API
 * (POST /auth/session) from the visitor's ID token. Server code only.
 *
 * It decides which *pages* the proxy serves, nothing else. Data always comes
 * from the API, which wants a fresh ID token and checks revocation on every
 * call, so a stolen or stale cookie shows an empty shell at most.
 *
 * `__Host-` (production) pins the cookie to this exact host over HTTPS: no
 * subdomain or plain-HTTP page can set or overwrite it. Browsers refuse that
 * prefix without `Secure`, which plain-HTTP localhost can't always offer.
 *
 * This assumes the app is served straight from its own origin (a Node host,
 * Vercel, a container…), which is how it is deployed. If it is ever put
 * behind Firebase Hosting rewrites, the name must become `__session` in
 * production too: Firebase Hosting strips every other cookie before the
 * request reaches the app, so nobody would ever appear signed in.
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-session" : "__session";

/** Attributes shared by setting and clearing: a cookie is only replaced by one with the same name, path and domain. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: a link from an email or WhatsApp must still open the app signed in.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "myhoodora-e9ba5";
const ADMIN_APP = "session-verifier";

// Checking a signature needs Google's public keys, not our service account:
// the Admin SDK runs here with no credentials (they stay in the API).
function verifier() {
  const app = getApps().find((a) => a.name === ADMIN_APP) ?? initializeApp({ projectId: PROJECT_ID }, ADMIN_APP);
  return getAuth(app);
}

/**
 * Google's signing keys couldn't be downloaded, so a signature can't be
 * checked right now. That says nothing about the token: callers must not
 * treat it as forged or expired, and so must not sign anyone out over it.
 */
export class VerifierUnavailableError extends Error {
  constructor() {
    super("Google's signing keys could not be fetched");
    this.name = "VerifierUnavailableError";
  }
}

/**
 * Did verification fail because the keys couldn't be fetched, not because of
 * the token?
 *
 * firebase-admin 13 reports both with the same code (auth/argument-error);
 * only the message tells them apart: "Error fetching public keys for Google
 * certs: …" for an HTTP error from Google, "Error while making request: …"
 * for a network error or timeout (its lib/utils/jwt.js and
 * lib/auth/token-verifier.js). session-cookie-outage.test.ts runs the real
 * SDK with its network blocked, so an upgrade that rewords these fails a test
 * instead of quietly signing people out again. The API has the same check
 * (apps/api/src/shared/auth/firebase-outage.ts).
 */
export function isKeyFetchFailure(err: unknown): boolean {
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
  return code === "auth/argument-error" && typeof message === "string" && /^Error (fetching (public keys|Json Web Keys)|while making request)/.test(message);
}

async function claimsOrNull(verify: () => Promise<DecodedIdToken>): Promise<DecodedIdToken | null> {
  try {
    return await verify();
  } catch (err) {
    if (isKeyFetchFailure(err)) throw new VerifierUnavailableError();
    return null;
  }
}

/**
 * The claims of a genuine, unexpired session cookie for this project, else
 * null. Signature, issuer, audience and expiry only. Whether it has been
 * revoked takes credentials and a call to Firebase: that is the API's job
 * (lib/auth/session-gate.ts asks it for the proxy).
 *
 * Throws VerifierUnavailableError when it couldn't find out.
 */
export async function verifySessionCookie(value: string | undefined): Promise<DecodedIdToken | null> {
  if (!value) return null;
  return claimsOrNull(() => verifier().verifySessionCookie(value));
}

/**
 * The claims of a genuine, unexpired ID token for this project, else null.
 * Throws VerifierUnavailableError when it couldn't find out.
 */
export async function verifyIdToken(value: string): Promise<DecodedIdToken | null> {
  return claimsOrNull(() => verifier().verifyIdToken(value));
}

/**
 * CSRF check for the routes that set or clear the cookie. Browsers state
 * where a request came from and page script can't forge it, so another site
 * can neither plant its own session here (login CSRF) nor sign someone out.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  // Browsers without Fetch Metadata still send Origin on every POST.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}
