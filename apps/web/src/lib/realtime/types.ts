/**
 * Live update events from GET /realtime/stream (docs/api-contract.md §19).
 * They're hints with ids only: screens refetch through the normal API,
 * which applies blocks, removals and the viewer's own state.
 */
export type RealtimeEventType =
  | "post.created"
  | "post.updated"
  | "post.deleted"
  | "comment.created"
  | "comment.deleted"
  | "notification.created"
  | "unread.changed"
  | "chat.message"
  | "chat.read"
  | "group.post"
  | "listing.created"
  | "listing.updated"
  | "support.message"
  | "inbox.updated"
  | "queue.changed"
  | "session.changed";

export interface RealtimeEvent {
  type: RealtimeEventType;
  id?: string;
  postId?: string;
  conversationId?: string;
  threadId?: string;
  groupId?: string;
  at: string;
}

/** idle: signed out or preview mode · live · reconnecting · offline: fallen back to polling. */
export type RealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";
