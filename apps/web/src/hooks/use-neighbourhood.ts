"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchNeighborhood, type NeighborhoodSummary } from "@/lib/firebase/auth";
import type { Viewer } from "@/lib/api/users";

// One fetch per neighbourhood per page load, shared by header, rail, cards.
const cache = new Map<string, Promise<NeighborhoodSummary | null>>();

/** The signed-in user's neighbourhood (name, city, centre point). */
export function useNeighbourhood(): NeighborhoodSummary | null {
  const { user, profile } = useAuth();
  const id = profile?.neighborhoodId;
  const [hood, setHood] = useState<NeighborhoodSummary | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    if (!cache.has(id)) {
      cache.set(
        id,
        fetchNeighborhood(user, id).catch((err) => {
          console.error("Failed to fetch neighbourhood:", err);
          cache.delete(id);
          return null;
        }),
      );
    }
    void cache.get(id)!.then((n) => {
      if (!cancelled) setHood(n);
    });
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  return hood;
}

/** Viewer identity for resolveAuthor(), including the neighbourhood name. */
export function useViewer(): Viewer {
  const { user, profile } = useAuth();
  const hood = useNeighbourhood();
  return {
    user,
    profile: profile ? { displayName: profile.displayName, neighborhoodName: hood?.name } : null,
  };
}
