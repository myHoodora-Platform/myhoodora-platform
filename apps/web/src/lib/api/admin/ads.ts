import type { User } from "firebase/auth";
import type { AdminAd, AdminAdInput, AdPlacementSettings, AdStatsRange, AdStatus } from "@myhoodora/api-contract/ads";
import { ApiError, apiFetch } from "../client";
import { isLive } from "../config";
import { adminGet, adminSend } from "./http";

/** Ads exist only on the live API; preview (mock) mode says so instead of inventing data. */
function requireLive(): void {
  if (!isLive("admin.ads")) throw new ApiError("Ads need the live API. Turn off preview mode to manage them.", 503, "server");
}

/** live: GET /admin/ads?status&q (contract §32) */
export async function listAds(user: User, query: { status?: AdStatus | "all"; q?: string } = {}): Promise<AdminAd[]> {
  requireLive();
  return adminGet(user, "/ads", query);
}

/** live: GET /admin/ads/:id */
export async function getAd(user: User, id: string): Promise<AdminAd> {
  requireLive();
  return adminGet(user, `/ads/${encodeURIComponent(id)}`);
}

/** live: POST /admin/ads → a draft */
export async function createAd(user: User, input: AdminAdInput): Promise<AdminAd> {
  requireLive();
  return adminSend(user, "/ads", input);
}

/** live: PATCH /admin/ads/:id */
export async function updateAd(user: User, id: string, input: AdminAdInput): Promise<AdminAd> {
  requireLive();
  return adminSend(user, `/ads/${encodeURIComponent(id)}`, input, "PATCH");
}

/** live: PUT /admin/ads/:id/status. Going live checks the ad is complete. */
export async function setAdStatus(user: User, id: string, status: AdStatus): Promise<AdminAd> {
  requireLive();
  return apiFetch(user, `/admin/ads/${encodeURIComponent(id)}/status`, { method: "PUT", json: { status } });
}

/** live: DELETE /admin/ads/:id. Soft: it leaves the feed, its stats are kept. */
export async function deleteAd(user: User, id: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/ads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** live: GET /admin/ads/:id/stats?from&to (default the last 30 days) */
export async function getAdStats(user: User, id: string, range: { from?: string; to?: string } = {}): Promise<AdStatsRange> {
  requireLive();
  return adminGet(user, `/ads/${encodeURIComponent(id)}/stats`, range);
}

/** live: GET /admin/ads/settings */
export async function getAdSettings(user: User): Promise<AdPlacementSettings> {
  requireLive();
  return adminGet(user, "/ads/settings");
}

/** live: PATCH /admin/ads/settings */
export async function updateAdSettings(user: User, patch: Partial<AdPlacementSettings>): Promise<AdPlacementSettings> {
  requireLive();
  return adminSend(user, "/ads/settings", patch, "PATCH");
}
