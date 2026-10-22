/**
 * Where tapping a push goes. Pushes carry the web's route (`href`, e.g. "/p/<id>"), and the app's
 * routes use the same paths, so a route the app has opens directly. A route the app doesn't have yet
 * (events, groups…) opens the notifications list, where the same notification is waiting.
 */
const ID = "[A-Za-z0-9_-]+";
const APP_ROUTES: RegExp[] = [
  /^\/news-feed$/,
  /^\/notifications$/,
  new RegExp(`^/p/${ID}$`),
  /^\/more$/,
  /^\/search$/,
  /^\/for-sale$/,
  new RegExp(`^/for-sale/${ID}$`),
  /^\/inbox$/,
  new RegExp(`^/inbox/${ID}$`),
  /^\/inbox\/support$/,
  new RegExp(`^/inbox/support/${ID}$`),
  /^\/settings(\/(profile|notifications|privacy|email|neighbourhoods))?$/,
];

export const FALLBACK_ROUTE = "/notifications";

export function routeForHref(href: unknown): string {
  if (typeof href !== "string") return FALLBACK_ROUTE;
  // Only the path: no query or fragment, nothing outside the app.
  const path = href.split(/[?#]/)[0] ?? "";
  return APP_ROUTES.some((r) => r.test(path)) ? path : FALLBACK_ROUTE;
}

/** True if the app has a screen for this href (otherwise the notifications list offers to open it on the web). */
export function isAppRoute(href: string): boolean {
  return routeForHref(href) === href.split(/[?#]/)[0];
}
