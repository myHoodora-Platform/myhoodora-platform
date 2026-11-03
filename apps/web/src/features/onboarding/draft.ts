import { splitAddress, type AddressParts, type PinSource } from "./address";

const DRAFT_KEY_PREFIX = "myhoodora:onboarding-draft:";
/** Pre-fix drafts were shared by every account on the device. */
const LEGACY_DRAFT_KEY = "myhoodora:onboarding-draft";

export interface OnboardingDraft {
  name: string;
  address: AddressParts;
  coords: { lat: number; lng: number } | null;
  /** Where `coords` came from. */
  pinSource: PinSource | null;
  /** Last step reached (1 or 2), so a refresh resumes where they were. */
  step?: number;
}

/** Drafts saved before the address was split into street, area and city. */
type StoredDraft = Omit<OnboardingDraft, "address" | "pinSource"> & { address: AddressParts | string; pinSource?: PinSource | null };

// Keeps the step-1 fields around locally as they're typed (no backend write,
// no isOnboarded change) so a refresh, "Skip for now" or closing the tab
// doesn't mean retyping everything. Keyed by account: a home address must
// never be shown to the next person who signs in on a shared device.
export function readOnboardingDraft(uid: string): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + uid);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (typeof draft.address === "string") {
      // An old one-line address: its pin came from looking that line up, so check it again.
      return { ...draft, address: splitAddress(draft.address), coords: null, pinSource: null, step: 1 };
    }
    return { ...draft, address: draft.address, pinSource: draft.pinSource ?? null };
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(uid: string, draft: OnboardingDraft) {
  try {
    localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(draft));
  } catch {
    // Private browsing / full storage — losing the draft isn't fatal.
  }
}

export function clearOnboardingDraft(uid: string) {
  try {
    localStorage.removeItem(DRAFT_KEY_PREFIX + uid);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

/** On sign-out: drop every account's draft (they contain home addresses). */
export function clearAllOnboardingDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key === LEGACY_DRAFT_KEY || key?.startsWith(DRAFT_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

// "Skip for now" is remembered per account, so someone who chose limited
// access isn't bounced back to /onboarding on every visit. Finishing
// onboarding clears it.
const SKIPPED_KEY = "myhoodora:onboarding-skipped";

export function markOnboardingSkipped(uid: string) {
  try {
    localStorage.setItem(SKIPPED_KEY, uid);
  } catch {
    // Without storage they'll just see onboarding again next time.
  }
}

export function hasSkippedOnboarding(uid: string): boolean {
  try {
    return localStorage.getItem(SKIPPED_KEY) === uid;
  } catch {
    return false;
  }
}

export function clearOnboardingSkipped() {
  try {
    localStorage.removeItem(SKIPPED_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
