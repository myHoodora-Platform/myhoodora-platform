import { API_BASE_URL, USE_MOCKS } from "./config";

/** The anonymous funnel step names (contract §43): just a name and the day are counted. */
export type FunnelEvent = "shared_view" | "shared_join_tap" | "invite_view" | "poster_view" | "badge_view" | "banner_shown" | "banner_open" | "banner_dismiss" | "sheet_shown" | "sheet_open" | "sheet_dismiss";

/** Fire and forget; never slows a page down or throws. */
export function trackFunnel(event: FunnelEvent): void {
  if (USE_MOCKS || typeof window === "undefined") return;
  void fetch(`${API_BASE_URL}/public/funnel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }), keepalive: true }).catch(() => undefined);
}
