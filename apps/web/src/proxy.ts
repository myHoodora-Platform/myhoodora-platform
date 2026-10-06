import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { USE_MOCKS, isLive } from "@/lib/api/config";
import { SESSION_COOKIE, VerifierUnavailableError, sessionCookieOptions, verifySessionCookie } from "@/lib/auth/session-cookie";
import { sessionVerdict, staffVerdict } from "@/lib/auth/session-gate";
import {
  DEFAULT_APP_ROUTE,
  isGuestOnlyPath,
  isPublicPath,
  legacyRedirectFor,
} from "@/lib/routes";

/**
 * - none: no session cookie.
 * - rejected: a cookie that must not count. Forged, expired, from another
 *   project, or revoked since it was issued (the API says so; see session-gate).
 * - valid: genuine and still live.
 *
 * Having a cookie is never enough. This still only decides which page to
 * serve: what the person may see or do is the API's call on every request.
 */
type SessionState = "none" | "valid" | "rejected";

async function sessionState(request: NextRequest): Promise<SessionState> {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return "none";
  try {
    if (!(await verifySessionCookie(cookie))) return "rejected";
  } catch (err) {
    // Google's signing keys can't be fetched from this server, so the signature
    // can't be checked here. That is an outage, not a bad cookie: keep it and
    // let the API judge it below. If the API can't either, the page loads,
    // exactly as when the API is unreachable (see sessionVerdict).
    if (!(err instanceof VerifierUnavailableError)) throw err;
  }
  return (await sessionVerdict(cookie)) === "revoked" ? "rejected" : "valid";
}

/** A rejected cookie leaves with the response: it is judged once, and /login can't mistake it for a session. */
function dropSession(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
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

  // Mock mode has no API, so nothing can mint or check a session cookie:
  // there is no server session and no server-side gate. Signed-out visitors
  // are turned away by the pages themselves (AppShell, AdminShell, onboarding),
  // which is enough for a build that only ever shows in-browser sample data.
  if (USE_MOCKS) return NextResponse.next();

  // Costs nothing for visitors without a cookie; with one, it is checked
  // wherever they land, so a rejected cookie never lingers.
  const session = await sessionState(request);
  const settle = (response: NextResponse) => (session === "rejected" ? dropSession(response) : response);

  // Public pages (about, privacy, guidelines…) are readable either way.
  const isLanding = pathname === "/";
  if (!isLanding && isPublicPath(pathname)) return settle(NextResponse.next());

  // Signed-in neighbours skip the marketing landing page and the auth pages.
  if (isLanding || isGuestOnlyPath(pathname)) {
    if (session !== "valid") return settle(NextResponse.next());
    const target = isLanding ? DEFAULT_APP_ROUTE : safeNextPath(searchParams.get("next"));
    return noStoreRedirect(new URL(target, request.url));
  }

  // Default-deny: everything else is part of the signed-in app.
  if (session !== "valid") {
    const redirectUrl = new URL("/login", request.url);
    // Remember the deep link (e.g. /p/abc) so login can return to it.
    const wanted = pathname + request.nextUrl.search;
    if (wanted !== DEFAULT_APP_ROUTE) redirectUrl.searchParams.set("next", wanted);
    return settle(noStoreRedirect(redirectUrl));
  }

  // Admin portal: staff only. Checked here, before anything renders, so
  // non-staff get the ordinary 404 page (same body as a made-up URL) and
  // never receive admin code. The API still authorises every admin call.
  if (isAdminPath(pathname) && isLive("admin.session")) {
    const verdict = await staffVerdict(request.cookies.get(SESSION_COOKIE)!.value);
    if (verdict === "expired") {
      // Revoked in the moment since the check above.
      return dropSession(noStoreRedirect(new URL(`/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`, request.url)));
    }
    if (verdict === "not_staff") {
      return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
    }
    // Staff, or the API is unreachable: let the page load. AdminShell
    // re-checks /admin/me and shows its own error state.
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
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
