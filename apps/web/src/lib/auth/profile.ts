import { ApiError, FRIENDLY_MESSAGES } from "@/lib/api/client";

import type { UserProfile } from "@myhoodora/api-contract/types";
import { needsLegalAcceptance } from "@myhoodora/api-contract/legal";

export type { UserProfile };

// Shared with the mobile app (packages/api-contract).
export { STAFF_ROLES, isStaff } from "@myhoodora/api-contract/roles";

/** Still has to give a date of birth: nothing else in the app until they do (docs/compliance/ndpa.md §1). */
export function needsAgeCheck(profile: Pick<UserProfile, "ageConfirmed"> | null | undefined): boolean {
  return profile?.ageConfirmed === false;
}

/** A material change to the Terms or Privacy Policy they haven't agreed to (or a new account that never has). */
export function needsTermsAcceptance(profile: Pick<UserProfile, "legal"> | null | undefined): boolean {
  return needsLegalAcceptance(profile?.legal);
}

/** Closed by its owner (deactivated, or deletion scheduled): "Welcome back" before anything else. */
export function isClosed(profile: Pick<UserProfile, "closure"> | null | undefined): boolean {
  return !!profile?.closure;
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
