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

/** The signed-in person's own badge (GET /engagement/me), for their own posts and avatar. */
let myBadge: import("@myhoodora/api-contract/engagement").AvatarBadge | undefined;
export function rememberMyBadge(badge: typeof myBadge): void {
  myBadge = badge;
}

export function rememberAuthor(card: { uid: string; displayName: string; photoURL?: string; neighborhoodName?: string; badge?: import("@myhoodora/api-contract/engagement").AvatarBadge } | undefined): void {
  if (!card) return;
  const prev = knownAuthors.get(card.uid);
  // The badge follows the latest card (it can be taken away), unlike the Hood name.
  knownAuthors.set(card.uid, { ...prev, verified: true, ...card, neighborhoodName: card.neighborhoodName ?? prev?.neighborhoodName, badge: card.badge });
}

/**
 * Synchronous best-effort identity for rendering lists (feed, comments,
 * chat). The viewer is always known; authors embedded by the live API are
 * remembered as posts/comments load; seeded neighbours resolve in preview;
 * anyone else shows as "Neighbour" (detail screens fetch GET /users/:uid/public).
 */
/**
 * What the API puts where a deleted person's id used to be, in conversations
 * the other person keeps (docs/api-contract.md §27). It points at nobody:
 * there is no profile behind it and nothing can be sent to it.
 */
export const DELETED_USER_UID = "deleted-user";

export function resolveAuthor(uid: string, viewer: Viewer): PublicProfile {
  if (uid === DELETED_USER_UID) return { uid, displayName: "Deleted User", verified: false };
  if (viewer.user && uid === viewer.user.uid) {
    const extras = myProfileExtras(uid);
    return {
      uid,
      displayName: viewer.profile?.displayName || viewer.user.email || "You",
      photoURL: extras.photoURL ?? viewer.profile?.photoURL ?? viewer.user.photoURL ?? undefined,
      bio: extras.bio ?? viewer.profile?.bio,
      neighborhoodName: viewer.profile?.neighborhoodName,
      verified: true,
      ...(myBadge && { badge: myBadge }),
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
