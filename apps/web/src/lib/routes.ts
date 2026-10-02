/**
 * Single source of truth for app URLs. Structure mirrors Nextdoor's flat,
 * noun-based routes (/news_feed, /p/{id}, /for_sale_and_free, /g/{id}) —
 * see docs/product/nextdoor-research.md.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  onboarding: "/onboarding",

  newsFeed: "/news-feed",
  post: (id: string) => `/p/${id}`,
  forSale: "/for-sale",
  search: (q?: string, type?: string) => `/search${q ? `?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}` : ""}`,
  listing: (id: string) => `/for-sale/${id}`,
  alerts: "/alerts",
  events: "/events",
  groups: "/groups",
  groupNew: "/groups/new",
  group: (id: string) => `/g/${id}`,
  groupManage: (id: string) => `/g/${id}/manage`,
  notifications: "/notifications",
  inbox: "/inbox",
  conversation: (id: string) => `/inbox/${id}`,
  support: "/inbox/support",
  supportThread: (id: string) => `/inbox/support/${id}`,
  profile: (uid: string) => `/profile/${uid}`,
  settings: "/settings",
  settingsProfile: "/settings/profile",
  settingsAccount: "/settings/account",
  settingsNeighbourhood: "/settings/neighbourhood",
  settingsNotifications: "/settings/notifications",
  settingsPrivacy: "/settings/privacy",
  settingsModeration: "/settings/moderation",
  leads: "/leads",
  help: "/help",
  guidelines: "/guidelines",

  admin: "/admin",
} as const;

/** Where a signed-in user lands by default (after login, from the logo, etc.). */
export const DEFAULT_APP_ROUTE = ROUTES.newsFeed;

/**
 * Pages anyone can open without signing in. Everything not listed here (and
 * not a guest-only auth page) is protected by src/proxy.ts — default-deny, so
 * a newly added app route can't accidentally ship publicly.
 */
export const PUBLIC_PATHS = [
  "/",
  "/about",
  "/how-it-works",
  "/safety",
  "/ai",
  "/careers",
  "/press",
  "/contact",
  "/guidelines",
  "/privacy",
  "/terms",
  "/reset-password",
  "/verify-email",
] as const;
// "/business/claim" is under /business but needs a signed-in user; the page itself handles that.
export const PUBLIC_PREFIXES = ["/coming-soon", "/business"] as const;

/** Auth pages a signed-in user is bounced away from. */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const;

export function isPublicPath(pathname: string): boolean {
  return (
    (PUBLIC_PATHS as readonly string[]).includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function isGuestOnlyPath(pathname: string): boolean {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
}

/**
 * Pages the proxy only serves to someone *with* a valid session cookie:
 * the signed-in app, onboarding and the admin. Being on one proves the
 * cookie exists.
 */
export function isSessionOnlyPath(pathname: string): boolean {
  return !isPublicPath(pathname) && !isGuestOnlyPath(pathname);
}

/**
 * Old /dashboard URLs → new routes, so links people already shared keep
 * working. `/dashboard?post=<id>` is handled separately (→ /p/<id>).
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/dashboard": ROUTES.newsFeed,
  "/dashboard/safety-watch": ROUTES.alerts,
  "/dashboard/marketplace": ROUTES.forSale,
  "/dashboard/events": ROUTES.events,
  "/dashboard/settings": ROUTES.settings,
  "/dashboard/settings/account": ROUTES.settingsAccount,
};

export function legacyRedirectFor(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname === "/dashboard") {
    const postId = searchParams.get("post");
    if (postId) return ROUTES.post(postId);
  }
  return LEGACY_REDIRECTS[pathname] ?? null;
}
