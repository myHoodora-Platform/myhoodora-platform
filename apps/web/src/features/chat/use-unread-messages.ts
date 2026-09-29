"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMockChanges } from "@/hooks/use-mock-changes";
import { fetchUnreadTotal } from "@/lib/api/chat";

const POLL_MS = 60_000;

/**
 * Unread message count for the header/tab badge. Live: polled every minute
 * and whenever the tab regains focus (contract §5: polling before realtime).
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const version = useMockChanges("chat:");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetchUnreadTotal(user)
        .then((n) => alive && setCount(n))
        .catch(() => undefined); // A badge isn't worth an error toast.
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, version]);

  return count;
}
