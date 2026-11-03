import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AddressParts } from "@myhoodora/api-contract/lookups";
import { secureStorage } from "@/core/firebase/secure-storage";

/**
 * What onboarding keeps on this phone between visits, per account, as the web does (draft.ts there):
 * the details typed so far, so leaving the app or skipping doesn't mean typing them again, and whether
 * the person chose "Skip for now". The draft holds a home address, so it lives in the Keychain or
 * Keystore, and is deleted on logout.
 */

/** Where the coordinates came from: the phone (GPS), the typed street, only its area, or the account. */
export type CoordsSource = "gps" | "street" | "area" | "saved";

export interface OnboardingDraft {
  name: string;
  address: AddressParts;
  coords: { lat: number; lng: number } | null;
  source: CoordsSource | null;
  /** How far off the phone said it might be, in metres (GPS only). */
  accuracyM: number | null;
  /** The step reached, so returning resumes there. */
  step: "details" | "confirm";
}

const draftKey = (uid: string) => `onboarding.draft.${uid}`;
const skippedKey = (uid: string) => `onboarding.skipped.${uid}`;

export async function readDraft(uid: string): Promise<OnboardingDraft | null> {
  try {
    const raw = await secureStorage.getItem(draftKey(uid));
    const draft = raw ? (JSON.parse(raw) as OnboardingDraft) : null;
    return draft && typeof draft.name === "string" && draft.address ? draft : null;
  } catch {
    return null;
  }
}

export async function saveDraft(uid: string, draft: OnboardingDraft): Promise<void> {
  // Losing a draft only means typing again: never let it fail the step.
  await secureStorage.setItem(draftKey(uid), JSON.stringify(draft)).catch(() => undefined);
}

export async function clearDraft(uid: string): Promise<void> {
  await secureStorage.removeItem(draftKey(uid)).catch(() => undefined);
}

/** "Skip for now": limited access, without being sent back to onboarding on every launch. */
export async function hasSkippedOnboarding(uid: string): Promise<boolean> {
  return (await AsyncStorage.getItem(skippedKey(uid)).catch(() => null)) === "1";
}

export async function markOnboardingSkipped(uid: string): Promise<void> {
  await AsyncStorage.setItem(skippedKey(uid), "1").catch(() => undefined);
}

export async function clearOnboardingSkipped(uid: string): Promise<void> {
  await AsyncStorage.removeItem(skippedKey(uid)).catch(() => undefined);
}
