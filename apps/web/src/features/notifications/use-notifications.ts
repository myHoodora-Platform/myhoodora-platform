"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/features/feed/feed-context";
import { useMockChanges } from "@/hooks/use-mock-changes";
import { listConversations } from "@/lib/api/chat";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import type { AppNotification } from "@/lib/api/types";

export function useNotifications() {
  const { user, profile } = useAuth();
  const { posts } = useFeed();
  const version = useMockChanges();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const conversations = await listConversations(user);
        const next = await listNotifications(user, {
          posts,
          conversations,
          verificationStatus: profile?.verificationStatus,
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
  }, [user, posts, profile?.verificationStatus, version]);

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      await markNotificationRead(user, id);
    },
    [user],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setItems((prev) => prev.map((n) => (n.type === "verification" ? n : { ...n, read: true })));
    await markAllNotificationsRead(user);
  }, [user]);

  return {
    items,
    loading,
    unreadCount: items.filter((n) => !n.read).length,
    markRead,
    markAllRead,
  };
}
