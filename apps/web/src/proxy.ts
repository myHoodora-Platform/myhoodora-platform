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
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuestOnlyRoute && isValidSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
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
