/**
 * What features keep on the phone per account and must not leave behind at logout (chat drafts,
 * say). Each registers its own cleanup; core/ never has to know about features.
 */
type Cleanup = (uid: string) => Promise<void>;
const cleanups = new Set<Cleanup>();

export function registerLogoutCleanup(cleanup: Cleanup): void {
  cleanups.add(cleanup);
}

/** Runs them all; one failing never stops the logout. */
export async function runLogoutCleanups(uid: string): Promise<void> {
  await Promise.all([...cleanups].map((c) => c(uid).catch(() => undefined)));
}
