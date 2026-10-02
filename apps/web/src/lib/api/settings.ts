import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, save } from "./mock/store";

// ── Preferences (notifications + privacy) ───────────────────────────────────

export type NotificationCategory =
  | "urgent_alerts"
  | "alerts"
  | "comments"
  | "messages"
  | "events"
  | "for_sale"
  | "groups";

export interface ChannelPrefs {
  push: boolean;
  email: boolean;
}

export interface Preferences {
  notifications: Record<NotificationCategory, ChannelPrefs>;
  /** Email summary of neighbourhood activity. */
  digest: "daily" | "weekly" | "off";
  privacy: {
    /** Who can see your full profile (bio, neighbour since, posts). */
    profileVisibility: "neighbourhood" | "nearby";
    /** Who can start a private conversation with you. */
    messaging: "neighbourhood" | "contacts" | "nobody";
    showNeighbourSince: boolean;
  };
}

export const DEFAULT_PREFERENCES: Preferences = {
  notifications: {
    urgent_alerts: { push: true, email: true },
    alerts: { push: true, email: false },
    comments: { push: true, email: false },
    messages: { push: true, email: true },
    events: { push: false, email: false },
    for_sale: { push: false, email: false },
    groups: { push: true, email: false },
  },
  digest: "daily",
  privacy: { profileVisibility: "neighbourhood", messaging: "neighbourhood", showNeighbourSince: true },
};

const prefsKey = (uid: string) => `prefs:${uid}`;

/** live: GET /users/me/preferences */
export async function getPreferences(user: User): Promise<Preferences> {
  if (isLive("settings")) return apiFetch<Preferences>(user, "/users/me/preferences");
  await latency(150);
  return load(prefsKey(user.uid), () => DEFAULT_PREFERENCES);
}

/** live: PATCH /users/me/preferences (deep-merged) → Preferences */
export async function updatePreferences(user: User, next: Preferences): Promise<Preferences> {
  if (isLive("settings")) {
    return apiFetch<Preferences>(user, "/users/me/preferences", { method: "PATCH", json: next });
  }
  await latency(150);
  save(prefsKey(user.uid), next);
  return next;
}

// ── Profile extras (bio, photo) ─────────────────────────────────────────────

export interface ProfileExtras {
  bio?: string;
  /** null removes the photo. */
  photoURL?: string | null;
}

const extrasKey = (uid: string) => `profile-extra:${uid}`;

/** Sync read for rendering the viewer's own avatar/bio (preview only). */
export function myProfileExtras(uid: string): ProfileExtras {
  if (typeof window === "undefined" || isLive("settings")) return {};
  return load<ProfileExtras>(extrasKey(uid), () => ({}));
}

/** live: PATCH /users/me { bio, photoURL (https) } */
export async function updateProfileExtras(user: User, extras: ProfileExtras): Promise<ProfileExtras> {
  if (isLive("settings")) return apiFetch<ProfileExtras>(user, "/users/me", { method: "PATCH", json: extras });
  await latency(200);
  const next = { ...myProfileExtras(user.uid), ...extras };
  save(extrasKey(user.uid), next);
  return next;
}

// ── Blocking ────────────────────────────────────────────────────────────────

const blocksKey = (uid: string) => `blocks:${uid}`;

/** Sync read so feeds can hide blocked neighbours without a round trip (preview). */
export function blockedUids(uid: string): string[] {
  if (typeof window === "undefined") return [];
  return load<string[]>(blocksKey(uid), () => []);
}

/** live: GET /users/me/blocks → string[] (uids) */
export async function listBlocked(user: User): Promise<string[]> {
  if (isLive("settings")) return apiFetch<string[]>(user, "/users/me/blocks");
  await latency(120);
  return blockedUids(user.uid);
}

/** live: POST /users/me/blocks { uid } — they can't message you or see your posts; you won't see theirs. */
export async function blockUser(user: User, uid: string): Promise<void> {
  if (isLive("settings")) {
    await apiFetch<void>(user, "/users/me/blocks", { method: "POST", json: { uid } });
    return;
  }
  await latency(150);
  save(blocksKey(user.uid), Array.from(new Set([...blockedUids(user.uid), uid])));
}

/** live: DELETE /users/me/blocks/:uid */
export async function unblockUser(user: User, uid: string): Promise<void> {
  if (isLive("settings")) {
    await apiFetch<void>(user, `/users/me/blocks/${uid}`, { method: "DELETE" });
    return;
  }
  await latency(150);
  save(blocksKey(user.uid), blockedUids(user.uid).filter((u) => u !== uid));
}

// ── Feedback & account ──────────────────────────────────────────────────────

export interface FeedbackInput {
  kind: "idea" | "problem" | "praise" | "other";
  message: string;
  /** Page the neighbour was on, for context. */
  path?: string;
}

/** live: POST /feedback */
export async function submitFeedback(user: User, input: FeedbackInput): Promise<void> {
  if (isLive("feedback")) {
    await apiFetch<void>(user, "/feedback", { method: "POST", json: input });
    return;
  }
  await latency(300);
  const all = load<(FeedbackInput & { uid: string; at: string })[]>("feedback", () => []);
  save("feedback", [...all, { ...input, uid: user.uid, at: new Date().toISOString() }]);
}

export const DEACTIVATION_REASONS = [
  { id: "moved", label: "I moved or am moving" },
  { id: "not_useful", label: "I didn't find it useful" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "too_many_notifications", label: "Too many notifications" },
  { id: "negative", label: "Too many negative posts" },
  { id: "few_neighbours", label: "Not enough neighbours on myHoodora" },
  { id: "duplicate", label: "I have another account" },
  { id: "other", label: "Something else" },
] as const;

export type DeactivationReason = (typeof DEACTIVATION_REASONS)[number]["id"];

/**
 * live: POST /users/me/deactivate { reason, details } — hides the profile
 * and posts; the account can be restored by logging in again within 30 days.
 * Returns whether the account was really deactivated (false in preview).
 */
export async function deactivateAccount(
  user: User,
  reason: DeactivationReason,
  details?: string,
): Promise<boolean> {
  if (isLive("settings")) {
    await apiFetch<void>(user, "/users/me/deactivate", { method: "POST", json: { reason, details } });
    return true;
  }
  await latency(400);
  return false;
}
