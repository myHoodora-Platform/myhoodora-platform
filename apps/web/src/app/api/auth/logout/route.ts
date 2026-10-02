import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isSameOrigin, sessionCookieOptions } from "@/lib/auth/session-cookie";

/**
 * Ends the server session in this browser only. Other devices keep theirs;
 * ending those is "sign out everywhere" (API: POST /auth/logout-everywhere).
 * Nothing to look up, so it is safe to call when already signed out.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
