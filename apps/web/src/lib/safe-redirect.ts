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
