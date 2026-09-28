"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { blockedUids } from "@/lib/api/settings";
import { useMockChanges } from "./use-mock-changes";

/** Neighbours the viewer has blocked (hidden from feeds and comments). */
export function useBlocked(): Set<string> {
  const { user } = useAuth();
  const version = useMockChanges("blocks:");
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (user) setBlocked(new Set(blockedUids(user.uid)));
  }, [user, version]);
  return blocked;
}
