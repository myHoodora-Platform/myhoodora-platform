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
  /^\/events$/,
  /^\/groups(\/new)?$/,
  new RegExp(`^/g/${ID}(/(manage|invite))?$`),
  /^\/settings(\/(profile|notifications|privacy|email|neighbourhoods|moderation))?$/,
  /^\/alerts$/,
  /^\/leads$/,
];

export const FALLBACK_ROUTE = "/notifications";

export function routeForHref(href: unknown): string {
  if (typeof href !== "string") return FALLBACK_ROUTE;
  // Only the path: no query or fragment, nothing outside the app.
  const [path = "", query = ""] = href.split("#")[0]!.split("?");
  if (!APP_ROUTES.some((r) => r.test(path))) return FALLBACK_ROUTE;
  // The one query kept: a group invite's token, which lets a private group's invitee in.
  const invite = new URLSearchParams(query).get("invite");
  return invite && /^\/g\/[^/]+$/.test(path) && /^[A-Za-z0-9_-]{8,64}$/.test(invite) ? `${path}?invite=${invite}` : path;
}

/** True if the app has a screen for this href (otherwise the notifications list offers to open it on the web). */
export function isAppRoute(href: string): boolean {
  const path = href.split(/[?#]/)[0] ?? "";
  return APP_ROUTES.some((r) => r.test(path));
}
