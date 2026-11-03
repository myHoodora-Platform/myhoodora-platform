import { isStaff, type UserProfile } from "@/lib/auth/profile";

const KEY_PREFIX = "myhoodora:tour:";

/**
 * pending → the account is new here and should see the tour once verified
 * started → shown; a refresh or navigating away doesn't bring it back
 * completed / skipped → finished either way; never shown again
 * No value → an existing member, who never gets it unprompted.
 */
export type TourStatus = "pending" | "started" | "completed" | "skipped";

const STATUSES: readonly TourStatus[] = ["pending", "started", "completed", "skipped"];

// Per tour and per account, so a shared device doesn't hand one neighbour's
// "done" to the next. Deliberately not cleared on sign-out: logging back in
// must not restart a tour they already finished or skipped.
const key = (tourId: string, uid: string) => `${KEY_PREFIX}${tourId}:${uid}`;

export function readTourStatus(tourId: string, uid: string): TourStatus | null {
  try {
    const raw = localStorage.getItem(key(tourId, uid));
    return STATUSES.includes(raw as TourStatus) ? (raw as TourStatus) : null;
  } catch {
    return null;
  }
}

export function writeTourStatus(tourId: string, uid: string, status: TourStatus) {
  try {
    localStorage.setItem(key(tourId, uid), status);
  } catch {
    // Private browsing / full storage: at worst the tour shows once more, or not at all.
  }
}

export const HOME_TOUR_ID = "home";

/**
 * Called with every loaded profile. Someone we see before they're verified is
 * a newcomer, so the tour waits for them; anyone first seen already verified
 * is an existing member and is left alone. Staff run the admin portal, not
 * the resident app, so they're skipped.
 */
export function noteTourEligibility(uid: string, profile: UserProfile) {
  if (isStaff(profile.role) || profile.verificationStatus === "verified") return;
  if (readTourStatus(HOME_TOUR_ID, uid) === null) writeTourStatus(HOME_TOUR_ID, uid, "pending");
}
