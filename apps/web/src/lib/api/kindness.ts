import type { User } from "firebase/auth";
import { needsKindnessReminder } from "@/features/feed/kindness";
import { apiFetch } from "./client";
import { isLive } from "./config";

export type KindnessReason = "insult" | "threat" | "shouting";
export interface KindnessResult {
  flagged: boolean;
  reasons: KindnessReason[];
}

const CHECK_TIMEOUT_MS = 3_000;
const PASS: KindnessResult = { flagged: false, reasons: [] };

/**
 * live: POST /moderation/check { text } → { flagged, reasons }. A nudge, not
 * a gate: if the check is slow or fails, posting goes ahead unprompted.
 */
export async function checkKindness(user: User, text: string): Promise<KindnessResult> {
  if (!isLive("moderation.check")) return needsKindnessReminder(text) ? { flagged: true, reasons: ["insult"] } : PASS;
  try {
    return await apiFetch<KindnessResult>(user, "/moderation/check", { method: "POST", json: { text }, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
  } catch {
    return PASS;
  }
}

const HINT: Record<KindnessReason, string> = {
  insult: "Name-calling can come across as hurtful.",
  threat: "Part of this could read as a threat.",
  shouting: "All capitals can read as shouting.",
};

/** One short line explaining why the reminder appeared. */
export function kindnessHint(reasons: KindnessReason[]): string {
  return reasons.length ? reasons.map((r) => HINT[r]).join(" ") : "Some of this might come across as hurtful.";
}
