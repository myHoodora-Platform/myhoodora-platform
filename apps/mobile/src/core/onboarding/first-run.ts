import AsyncStorage from "@react-native-async-storage/async-storage";
import { isStaff } from "@myhoodora/api-contract/roles";
import type { UserProfile } from "@myhoodora/api-contract/types";

/**
 * The first-run welcome on the feed, with the web's rules (apps/web/src/features/tour/storage.ts):
 *
 *   pending → a newcomer: seen here before they joined a Hood, so the welcome waits for them
 *   completed / skipped → done either way; never shown again
 *   none → an existing member (first seen already verified), never shown unprompted
 *
 * Per account, and kept after logout: logging back in must not bring back a welcome they closed.
 */
export type FirstRunStatus = "pending" | "completed" | "skipped";

const STATUSES: readonly FirstRunStatus[] = ["pending", "completed", "skipped"];
const key = (uid: string) => `firstrun.home.${uid}`;

export async function readFirstRun(uid: string): Promise<FirstRunStatus | null> {
  const raw = await AsyncStorage.getItem(key(uid)).catch(() => null);
  return STATUSES.includes(raw as FirstRunStatus) ? (raw as FirstRunStatus) : null;
}

export async function writeFirstRun(uid: string, status: FirstRunStatus): Promise<void> {
  await AsyncStorage.setItem(key(uid), status).catch(() => undefined);
}

/** Called with every loaded profile: a newcomer (not yet verified, not staff) is owed the welcome once. */
export async function noteFirstRunEligibility(uid: string, profile: UserProfile): Promise<void> {
  if (isStaff(profile.role) || profile.verificationStatus === "verified") return;
  if ((await readFirstRun(uid)) === null) await writeFirstRun(uid, "pending");
}
