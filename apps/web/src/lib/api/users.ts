import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency } from "./mock/store";
import { MOCK_NEIGHBOURS } from "./mock/seed";
import { myProfileExtras } from "./settings";
import type { PublicProfile } from "./types";

export interface Viewer {
  user: User | null;
  profile: { displayName?: string; photoURL?: string; bio?: string; neighborhoodName?: string } | null;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** Author cards the live API embeds in posts/comments (uid → card). */
const knownAuthors = new Map<string, PublicProfile>();

export function rememberAuthor(card: { uid: string; displayName: string; photoURL?: string; neighborhoodName?: string } | undefined): void {
  if (!card) return;
  const prev = knownAuthors.get(card.uid);
  knownAuthors.set(card.uid, { ...prev, verified: true, ...card, neighborhoodName: card.neighborhoodName ?? prev?.neighborhoodName });
}

/**
 * Synchronous best-effort identity for rendering lists (feed, comments,
 * chat). The viewer is always known; authors embedded by the live API are
 * remembered as posts/comments load; seeded neighbours resolve in preview;
 * anyone else shows as "Neighbour" (detail screens fetch GET /users/:uid/public).
 */
export function resolveAuthor(uid: string, viewer: Viewer): PublicProfile {
  if (viewer.user && uid === viewer.user.uid) {
    const extras = myProfileExtras(uid);
    return {
      uid,
      displayName: viewer.profile?.displayName || viewer.user.email || "You",
      photoURL: extras.photoURL ?? viewer.profile?.photoURL ?? viewer.user.photoURL ?? undefined,
      bio: extras.bio ?? viewer.profile?.bio,
      neighborhoodName: viewer.profile?.neighborhoodName,
      verified: true,
    };
  }
  const known = knownAuthors.get(uid);
  if (known) return known;
  const seeded = MOCK_NEIGHBOURS.find((n) => n.uid === uid);
  if (seeded) return seeded;
  return { uid, displayName: "Neighbour", verified: true };
}

/** live: GET /users/:uid/public (Hood-scoped; 404 if blocked or elsewhere) */
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
