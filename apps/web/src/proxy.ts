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
    pathname.startsWith("/dashboard") || pathname === "/onboarding";
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

  const response = NextResponse.next();
  // Protected pages must never be served from the browser's back-forward
  // cache after logout — without this, hitting "back" post-logout can show
  // a stale authenticated dashboard snapshot instead of re-running this
  // check. This forces a real revalidation request on every back/forward
  // navigation to a protected route.
  if (isProtectedRoute) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
