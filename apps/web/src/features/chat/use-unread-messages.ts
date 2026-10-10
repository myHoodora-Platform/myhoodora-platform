"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { fetchUnreadTotal } from "@/lib/api/chat";
import { fetchSupportUnread } from "@/lib/api/support";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import { createSharedLoader } from "@/lib/shared-loader";

/** Chats plus support conversations with an unread team reply. */
const unreadMessages = createSharedLoader((user: User) =>
  Promise.all([fetchUnreadTotal(user), fetchSupportUnread(user).catch(() => 0)]).then(([chat, support]) => chat + support),
);

/** Start loading the Messages badge before the header mounts (see AppShell). A badge isn't worth an error. */
export function prefetchUnreadMessages(user: User): void {
  void unreadMessages.load(user).catch(() => undefined);
}

/**
 * Unread count for the Messages badge. Shows the last known count at once,
 * then refreshes. Live: refetched when a message or read receipt arrives,
 * and after a reconnect (docs/api-contract.md §19).
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const version = useLiveVersion(["chat.message", "chat.read", "support.message", "unread.changed"], { mockPrefix: "chat:" });
  const [count, setCount] = useState(() => (user ? unreadMessages.peek(user.uid) : undefined) ?? 0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    unreadMessages
      .load(user, { force: version > 0 })
      .then((next) => alive && setCount(next))
      .catch(() => undefined); // A badge isn't worth an error toast.
    return () => {
      alive = false;
    };
  }, [user, version]);

  return count;
}
