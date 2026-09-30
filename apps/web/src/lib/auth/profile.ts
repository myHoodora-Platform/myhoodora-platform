import { ApiError, FRIENDLY_MESSAGES } from "@/lib/api/client";

export interface UserProfile {
  uid?: string;
  email?: string;
  /** False until the neighbour clicks the link in their welcome email (Google/Apple: true at once). */
  emailVerified?: boolean;
  isOnboarded: boolean;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  neighborhoodId?: string;
  verificationStatus?: string;
  /** Separate from verification: active | restricted | suspended (contract §13). */
  accountStatus?: "active" | "restricted" | "suspended";
  restrictedUntil?: string | null;
  role?: string;
  /** Set while a request to join a nearby Hood awaits staff review (verificationStatus "pending_review"). */
  requestedHood?: { id: string; name: string; requestedAt: string } | null;
}

/** Roles that can open the admin portal (the API decides what each can do there). */
export const STAFF_ROLES = ["owner", "admin", "moderator"] as const;

export function isStaff(role: string | null | undefined): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Where the signed-in user's profile stands. Kept separate from the profile
 * itself so "couldn't load it" is never mistaken for "not onboarded":
 * - idle: nobody is signed in
 * - loading: signed in, profile not fetched yet
 * - ready: profile loaded (it may be slightly stale if a later refresh failed)
 * - error: signed in, but the profile couldn't be loaded — show an error, not onboarding
 */
export type ProfileStatus = "idle" | "loading" | "ready" | "error";

/**
 * Validates a GET /users/me (or onboarding/update) response. Anything that
 * isn't a profile — `null`, an HTML page, a missing isOnboarded flag — is a
 * server fault, never a brand-new account.
 */
export function parseProfile(data: unknown): UserProfile {
  if (
    data !== null &&
    typeof data === "object" &&
    typeof (data as { isOnboarded?: unknown }).isOnboarded === "boolean"
  ) {
    return data as UserProfile;
  }
  throw new ApiError(FRIENDLY_MESSAGES.server, 200, "server");
}

/** Any thrown value as an ApiError, so callers can branch on `kind`. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(FRIENDLY_MESSAGES.server, 0, "server");
}
