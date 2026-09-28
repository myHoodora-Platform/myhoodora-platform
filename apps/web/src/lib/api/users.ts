import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency } from "./mock/store";
import { MOCK_NEIGHBOURS } from "./mock/seed";
import type { PublicProfile } from "./types";

export interface Viewer {
  user: User | null;
  profile: { displayName?: string; neighborhoodName?: string } | null;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * Synchronous best-effort identity for rendering lists (feed, comments,
 * chat). The viewer is always known; seeded neighbours resolve in preview;
 * anyone else shows as "Neighbour" until GET /users/:uid/public exists
 * (then `useProfile` below takes over on detail screens).
 */
export function resolveAuthor(uid: string, viewer: Viewer): PublicProfile {
  if (viewer.user && uid === viewer.user.uid) {
    return {
      uid,
      displayName: viewer.profile?.displayName || viewer.user.email || "You",
      photoURL: viewer.user.photoURL ?? undefined,
      neighborhoodName: viewer.profile?.neighborhoodName,
      verified: true,
    };
  }
  const seeded = MOCK_NEIGHBOURS.find((n) => n.uid === uid);
  if (seeded) return seeded;
  return { uid, displayName: "Neighbour", verified: true };
}

/** planned: GET /users/:uid/public */
export async function getPublicProfile(
  user: User,
  uid: string,
  viewer: Viewer,
): Promise<PublicProfile | null> {
  if (isLive("users.publicProfile")) {
    return apiFetch<PublicProfile>(user, `/users/${uid}/public`);
  }
  await latency();
  if (uid === user.uid) return resolveAuthor(uid, viewer);
  return MOCK_NEIGHBOURS.find((n) => n.uid === uid) ?? null;
}
