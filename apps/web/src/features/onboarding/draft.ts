const ONBOARDING_DRAFT_KEY = "myhoodora:onboarding-draft";

export interface OnboardingDraft {
  name: string;
  address: string;
  coords: { lat: number; lng: number } | null;
}

// Skipping onboarding shouldn't mean retyping everything later — these just
// keep the step-1 fields around locally (no backend write, no isOnboarded
// change) so the form is pre-filled next time someone lands back here, e.g.
// via the "finish onboarding" prompt on a gated action.
export function readOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing / full storage — losing the draft isn't fatal.
  }
}

export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
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
