import { DEFAULT_APP_ROUTE, isGuestOnlyPath, isPublicPath } from "@/lib/routes";

// Only send people back into the signed-in app. Anything else (other sites,
// protocol-relative "//evil.com", backslash tricks, public/marketing pages)
// falls back to the news feed.
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_APP_ROUTE;
  }
  const pathname = raw.split(/[?#]/)[0] ?? "";
  if (pathname.startsWith("/api") || isPublicPath(pathname) || isGuestOnlyPath(pathname)) {
    return DEFAULT_APP_ROUTE;
  }
  return raw;
}

/**
 * Where the sign-in and sign-up forms go once someone is signed in (and
 * their server session exists). A full page load on purpose, not
 * router.push(): if they were bounced to /login from the page they wanted,
 * the Next router remembers that redirect and can replay it instead of asking
 * the server again, leaving them on the login form although signed in. It
 * also drops whatever the router cached while they were signed out.
 * The path goes through safeNextPath, so it can only ever be inside the app.
 */
export function enterApp(path: string): void {
  window.location.assign(safeNextPath(path));
}
