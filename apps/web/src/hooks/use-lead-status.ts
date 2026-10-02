"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getLeadStatus, type LeadStatus } from "@/lib/api/moderation";

let cache: { uid: string; at: number; value: LeadStatus } | null = null;
const TTL_MS = 5 * 60_000;

/** Is the signed-in neighbour a Hood Lead (and how many reports wait)? Cached for 5 min. */
export function useLeadStatus(): LeadStatus | null {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<LeadStatus | null>(cache && user && cache.uid === user.uid ? cache.value : null);

  useEffect(() => {
    if (!user || profile?.verificationStatus !== "verified") return;
    if (cache && cache.uid === user.uid && Date.now() - cache.at < TTL_MS) {
      setStatus(cache.value);
      return;
    }
    let alive = true;
    getLeadStatus(user)
      .then((value) => {
        cache = { uid: user.uid, at: Date.now(), value };
        if (alive) setStatus(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, profile?.verificationStatus]);

  return status;
}

/** Call after voting so the badge count refreshes. */
export function invalidateLeadStatus() {
  cache = null;
}
