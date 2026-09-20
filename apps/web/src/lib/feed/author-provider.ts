import type { User } from "firebase/auth";

export interface ResolvedAuthor {
  displayName: string;
  initials: string;
  photoURL?: string;
  isSelf: boolean;
}

interface ViewerContext {
  user: User | null;
  profile: { displayName?: string } | null;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * Single swap point for author identity. There is no backend endpoint yet to
 * resolve another user's uid to a name/avatar (tracked in apps/api/README.md
 * TODOs), so every non-self author is shown generically. When that endpoint
 * exists, only this function needs to change.
 */
export function resolveAuthor(
  uid: string,
  { user, profile }: ViewerContext,
): ResolvedAuthor {
  if (user && uid === user.uid) {
    const displayName = profile?.displayName || user.email || "You";
    return {
      displayName,
      initials: initialsFrom(displayName),
      photoURL: user.photoURL ?? undefined,
      isSelf: true,
    };
  }

  return {
    displayName: "Neighbour",
    initials: "N",
    isSelf: false,
  };
}
