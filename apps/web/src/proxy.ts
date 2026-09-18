import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "myhoodora-e9ba5";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("__session")?.value;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname === "/onboarding";
  const isGuestOnlyRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  let isValidSession = false;

  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, JWKS, {
        issuer: `https://securetoken.google.com/${PROJECT_ID}`,
        audience: PROJECT_ID,
      });
      isValidSession = true;
    } catch (err) {
      console.warn(
        "Session verification failed inside proxy interceptor:",
        err,
      );
    }
  }

  // Intercepting Redirects
  if (isProtectedRoute && !isValidSession) {
    const redirectUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  }

  if (isGuestOnlyRoute && isValidSession) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  }

  // Note: normal pass-through responses intentionally allow the browser's
  // back-forward cache (no no-store here) — disabling bfcache for every
  // dashboard navigation made "back" force a full cold reload every time.
  // The stale-page-after-logout case this used to guard against is instead
  // handled client-side: AuthProvider listens for `pageshow` with
  // `event.persisted` and re-validates the session when a page is restored
  // from bfcache, which is the standard fix for this exact scenario.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
