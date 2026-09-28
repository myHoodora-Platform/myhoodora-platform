import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, save } from "./mock/store";
import { seedAlertResolutions } from "./mock/seed";

const KEY = "alert-resolved";

/** Sync map postId → resolvedAt for hydrating posts (preview). planned: `resolvedAt` on the post. */
export function alertResolutions(): Record<string, string> {
  if (typeof window === "undefined" || isLive("alerts")) return {};
  return load<Record<string, string>>(KEY, seedAlertResolutions);
}

/**
 * planned: PATCH /posts/:id/alert { resolved: true } → { resolvedAt }.
 * Author (or a neighbourhood lead) marks an alert as over, e.g. power back,
 * road cleared. Resolved alerts leave the active list immediately.
 */
export async function resolveAlert(user: User, postId: string): Promise<string> {
  if (isLive("alerts")) {
    const res = await apiFetch<{ resolvedAt: string }>(user, `/posts/${postId}/alert`, {
      method: "PATCH",
      json: { resolved: true },
    });
    return res.resolvedAt;
  }
  await latency(200);
  const resolvedAt = new Date().toISOString();
  save(KEY, { ...alertResolutions(), [postId]: resolvedAt });
  return resolvedAt;
}
