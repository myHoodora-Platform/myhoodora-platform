import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";

export type KindnessOutcome = "shown" | "edited" | "posted_anyway" | "discarded";

/**
 * live: POST /telemetry/kindness { outcome } → 204. Anonymous daily counter
 * behind the admin "kindness reminders" insight. Fire-and-forget: never
 * blocks or fails the post it's about.
 */
export function reportKindness(user: User | null, outcome: KindnessOutcome): void {
  if (!user || !isLive("telemetry")) return;
  void apiFetch<void>(user, "/telemetry/kindness", { method: "POST", json: { outcome } }).catch(() => undefined);
}
