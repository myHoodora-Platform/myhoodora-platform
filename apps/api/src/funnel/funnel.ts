/**
 * The web-to-app and sharing funnel (plan WP-F, WP-G, WP-H): anonymous daily counts of a few named
 * steps. Nothing about the person (no id, no address, no device): a name and a Lagos day.
 */
export const FUNNEL_EVENTS = [
  "shared_view", // a signed-out visitor opened a shared post
  "shared_join_tap", // …and tapped to join or sign in
  "invite_view", // someone opened a personal invite link (/i/<code>)
  "poster_view", // a printed poster's QR code was scanned (/i/<code>?src=qr)
  "banner_shown",
  "banner_open",
  "banner_dismiss",
  "sheet_shown",
  "sheet_open",
  "sheet_dismiss",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
