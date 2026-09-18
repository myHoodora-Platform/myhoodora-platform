/**
 * Tracks the newest Alert-type post timestamp the viewer has already seen,
 * per neighborhood — purely client-side, mirroring the reaction-emoji
 * memory pattern. There is no real push-notification backend yet (tracked
 * in apps/api/README.md TODOs), so this drives an honest "new since you
 * last looked" indicator on the bell, not a fake counter.
 */
function storageKey(neighborhoodId: string): string {
  return `lastSeenAlert:${neighborhoodId}`;
}

export function getLastSeenAlertAt(neighborhoodId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(neighborhoodId));
  } catch {
    return null;
  }
}

export function markAlertSeen(neighborhoodId: string, createdAt: string): void {
  try {
    const current = getLastSeenAlertAt(neighborhoodId);
    if (!current || new Date(createdAt) > new Date(current)) {
      window.localStorage.setItem(storageKey(neighborhoodId), createdAt);
    }
  } catch {
    // Best-effort only — a private browsing session can throw here.
  }
}
