import type { User } from "@firebase/auth";
import type { DeactivationReason, Preferences } from "@myhoodora/api-contract/settings";
import type { HoodRequestView, MyHoods, PublicProfile, UserProfile } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export const accountKeys = {
  preferences: ["me", "preferences"] as const,
  publicProfile: (uid: string) => ["profile", uid] as const,
};

/** `PATCH /users/me`: only these three; anything else is refused (contract §14). `photoURL: null` removes the photo. */
export function updateMe(user: User, patch: { displayName?: string; bio?: string; photoURL?: string | null }): Promise<UserProfile> {
  return apiFetch<UserProfile>(user, "/users/me", { method: "PATCH", json: patch });
}

/** What neighbours see of you (and "neighbour since", which only this returns). */
export function getPublicProfile(user: User, uid: string): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(user, `/users/${uid}/public`);
}

export function getPreferences(user: User): Promise<Preferences> {
  return apiFetch<Preferences>(user, "/users/me/preferences");
}

/** Deep-merged by the API, which returns the whole result. */
export function updatePreferences(user: User, patch: Partial<Preferences> | Record<string, unknown>): Promise<Preferences> {
  return apiFetch<Preferences>(user, "/users/me/preferences", { method: "PATCH", json: patch });
}

/** Hides the profile, posts and listings and signs out everywhere; logging in within 30 days restores it. */
export function deactivate(user: User, reason: DeactivationReason): Promise<void> {
  return apiFetch<void>(user, "/users/me/deactivate", { method: "POST", json: { reason } });
}

/**
 * `POST /users/me/email`: only while the address is unconfirmed, and only right after the password was
 * entered again (the API refuses an older sign-in).
 */
export function changeEmail(user: User, email: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(user, "/users/me/email", { method: "POST", json: { email } });
}

// ── Neighbourhoods (contract §31) ───────────────────────────────────────────

export const hoodKeys = {
  mine: ["me", "hoods"] as const,
  all: ["neighborhoods"] as const,
};

export function myHoods(user: User): Promise<MyHoods> {
  return apiFetch<MyHoods>(user, "/users/me/hoods");
}

/** Every open neighbourhood (names and cities), to choose one to follow. */
export function listHoods(user: User): Promise<{ _id: string; name: string; city: string }[]> {
  return apiFetch(user, "/neighborhoods");
}

/** Open neighbourhoods near a point, nearest first (names and cities). */
export function nearbyHoods(user: User, at: { lat: number; lng: number }, maxDistance = 8000): Promise<{ _id: string; name: string; city: string }[]> {
  return apiFetch(user, `/neighborhoods/nearby?${new URLSearchParams({ lat: String(at.lat), lng: String(at.lng), maxDistance: String(maxDistance) })}`);
}

export type NewHoodRequest = { kind: "secondary"; hoodId: string; reason: string } | { kind: "move"; address: string; lat: number; lng: number; reason: string };

export function requestHoodChange(user: User, body: NewHoodRequest): Promise<HoodRequestView> {
  return apiFetch<HoodRequestView>(user, "/users/me/hood-requests", { method: "POST", json: body });
}

export function withdrawHoodRequest(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/users/me/hood-requests/${id}`, { method: "DELETE" });
}

export function leaveSecondaryHood(user: User, hoodId: string): Promise<void> {
  return apiFetch<void>(user, `/users/me/secondary-hoods/${hoodId}`, { method: "DELETE" });
}
