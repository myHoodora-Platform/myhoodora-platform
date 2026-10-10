"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/features/feed/feed-context";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import { listConversations } from "@/lib/api/chat";
import { isLive } from "@/lib/api/config";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { createSharedLoader } from "@/lib/shared-loader";
import type { AppNotification } from "@/lib/api/types";

// The API builds the list by itself (GET /notifications): one request, shared
// by the bell and the notifications page, remembered so both paint at once.
const LIVE = isLive("notifications");
const notifications = createSharedLoader((user: User) => listNotifications(user, { posts: [], conversations: [] }));

/** Start loading the bell before the header mounts (see AppShell). */
export function prefetchNotifications(user: User): void {
  if (LIVE) void notifications.load(user).catch(() => undefined);
}

export function useNotifications() {
  const { user, profile } = useAuth();
  const { posts } = useFeed();
  // Live: every notification in the app arrives as notification.created.
  const version = useLiveVersion(["notification.created", "unread.changed", "chat.message", "chat.read"]);
  const [items, setItems] = useState<AppNotification[]>(() => (LIVE && user ? notifications.peek(user.uid) : undefined) ?? []);
  const [loading, setLoading] = useState(() => !(LIVE && user && notifications.peek(user.uid)));

  // Preview only: the list is derived in the browser from the feed, chats and
  // verification status, so it follows them. The API needs none of that.
  const previewPosts = LIVE ? null : posts;
  const previewStatus = LIVE ? null : profile?.verificationStatus;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = LIVE
          ? await notifications.load(user, { force: version > 0 })
          : await listNotifications(user, {
              posts: previewPosts ?? [],
              conversations: await listConversations(user),
              verificationStatus: previewStatus ?? undefined,
            });
        if (!cancelled) setItems(next);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, previewPosts, previewStatus, version]);

  // Optimistic: update what's on screen and what the other reader (bell or page) will paint.
  const update = useCallback(
    (change: (n: AppNotification) => AppNotification) => {
      setItems((prev) => {
        const next = prev.map(change);
        if (LIVE && user) notifications.set(user.uid, next);
        return next;
      });
    },
    [user],
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      update((n) => (n._id === id ? { ...n, read: true } : n));
      await markNotificationRead(user, id);
    },
    [user, update],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    update((n) => (n.type === "verification" ? n : { ...n, read: true }));
    await markAllNotificationsRead(user);
  }, [user, update]);

  return {
    items,
    loading,
    unreadCount: items.filter((n) => !n.read).length,
    markRead,
    markAllRead,
  };
}
