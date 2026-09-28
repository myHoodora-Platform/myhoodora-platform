import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { safeNextPath } from "@/lib/safe-redirect";
import {
  DEFAULT_APP_ROUTE,
  isGuestOnlyPath,
  isPublicPath,
  legacyRedirectFor,
} from "@/lib/routes";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "myhoodora-e9ba5";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get("__session")?.value;
  if (!sessionCookie) return false;
  try {
    await jwtVerify(sessionCookie, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return true;
  } catch (err) {
    console.warn("Session verification failed inside proxy interceptor:", err);
    return false;
  }
}

function noStoreRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Old /dashboard links (including shared `/dashboard?post=<id>`) keep working.
  const legacyTarget = legacyRedirectFor(pathname, searchParams);
  if (legacyTarget) {
    return NextResponse.redirect(new URL(legacyTarget, request.url), 308);
  }

  // Public pages never need the (network-backed) JWT check.
  if (isPublicPath(pathname)) return NextResponse.next();

  const isValidSession = await hasValidSession(request);

  if (isGuestOnlyPath(pathname)) {
    if (!isValidSession) return NextResponse.next();
    return noStoreRedirect(
      new URL(safeNextPath(searchParams.get("next")), request.url),
    );
  }

  // Default-deny: everything else is part of the signed-in app.
  if (!isValidSession) {
    const redirectUrl = new URL("/login", request.url);
    // Remember the deep link (e.g. /p/abc) so login can return to it.
    const wanted = pathname + request.nextUrl.search;
    if (wanted !== DEFAULT_APP_ROUTE) redirectUrl.searchParams.set("next", wanted);
    return noStoreRedirect(redirectUrl);
  }

  // Note: normal pass-through responses intentionally allow the browser's
  // back-forward cache (no no-store here) — disabling bfcache for every
  // app navigation made "back" force a full cold reload every time.
  // The stale-page-after-logout case this used to guard against is instead
  // handled client-side: AuthProvider listens for `pageshow` with
  // `event.persisted` and re-validates the session when a page is restored
  // from bfcache, which is the standard fix for this exact scenario.
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, route handlers and static files
  // (anything with a file extension, e.g. /icon.png, /images/x.webp).
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
