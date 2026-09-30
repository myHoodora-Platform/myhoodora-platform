"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchUnreadTotal } from "@/lib/api/chat";
import { fetchSupportUnread } from "@/lib/api/support";
import { useLiveVersion } from "@/lib/realtime/use-realtime";

/**
 * Unread count for the Messages badge: chats plus support conversations with
 * an unread team reply. Live: refetched when a message or read receipt
 * arrives, and after a reconnect (docs/api-contract.md §19).
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const version = useLiveVersion(["chat.message", "chat.read", "support.message", "unread.changed"], { mockPrefix: "chat:" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([fetchUnreadTotal(user), fetchSupportUnread(user).catch(() => 0)])
      .then(([chat, support]) => alive && setCount(chat + support))
      .catch(() => undefined); // A badge isn't worth an error toast.
    return () => {
      alive = false;
    };
  }, [user, version]);

  return count;
}
