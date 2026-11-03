import type { QueryClient } from "@tanstack/react-query";
import { NOTIFICATIONS_QUERY_KEY } from "@/core/push/use-push-notifications";
import { chatKeys } from "@/features/chat/chat-api";
import { feedKeys } from "@/features/feed/feed-api";
import { listingKeys } from "@/features/listings/listings-api";
import { supportKeys } from "@/features/support/support-api";
import { liveStore } from "./live-store";

/** The API's event (contract §19): a hint naming what changed, never the data itself. */
export interface LiveEvent {
  type: string;
  id?: string;
  postId?: string;
  conversationId?: string;
  /** Support conversations (support.message, support.typing). */
  threadId?: string;
  at?: string;
}

/**
 * What each hint refreshes. Only queries on screen refetch now (TanStack's default for invalidation);
 * the rest are marked stale and refetch when next shown, through the normal endpoints, so blocks,
 * removals and the viewer's own state always apply. Returns true for `session.changed` (reconnect).
 */
export function applyLiveEvent(client: QueryClient, e: LiveEvent): boolean {
  const postId = e.postId ?? e.id;
  switch (e.type) {
    case "post.created":
      // The feed never jumps: it offers "N new posts" instead.
      liveStore.postArrived(e.id ?? e.postId);
      return false;
    case "post.updated":
      if (postId) void client.invalidateQueries({ queryKey: feedKeys.post(postId), exact: true });
      return false;
    case "post.deleted":
      if (postId) client.removeQueries({ queryKey: feedKeys.post(postId) });
      void client.invalidateQueries({ queryKey: feedKeys.all });
      return false;
    case "comment.created":
    case "comment.deleted":
      if (postId) {
        void client.invalidateQueries({ queryKey: feedKeys.comments(postId) });
        void client.invalidateQueries({ queryKey: feedKeys.post(postId), exact: true });
      }
      return false;
    case "notification.created":
      void client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      return false;
    case "unread.changed":
      // Something was read, here or on another device: a notification, or a support conversation.
      // The web refreshes its counts on this too; without the last two, Messages kept a stale "1".
      void client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      void client.invalidateQueries({ queryKey: supportKeys.unread });
      void client.invalidateQueries({ queryKey: supportKeys.list });
      void client.invalidateQueries({ queryKey: chatKeys.unread });
      return false;
    case "chat.message":
    case "chat.read":
      // The list, the unread count, and that thread's messages.
      void client.invalidateQueries({ queryKey: chatKeys.all });
      return false;
    case "listing.created":
    case "listing.updated":
      void client.invalidateQueries({ queryKey: listingKeys.all });
      if (e.id) void client.invalidateQueries({ queryKey: listingKeys.one(e.id) });
      return false;
    case "support.message":
      // The team replied or started a conversation (contract §18).
      void client.invalidateQueries({ queryKey: supportKeys.all });
      return false;
    case "session.changed":
      return true;
    default:
      return false;
  }
}
