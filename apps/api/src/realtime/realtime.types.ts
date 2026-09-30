/**
 * Live update events. They are hints, never data: each carries ids only, and
 * clients refetch through the normal endpoints, which apply blocks, removals,
 * private groups and the viewer's own state. Nothing private rides a shared
 * channel this way. (docs/api-contract.md §19)
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
  /** Ephemeral: someone is typing in the conversation (never stored). */
  | "chat.typing"
  | "group.post"
  | "listing.created"
  | "listing.updated"
  | "support.message"
  /** Ephemeral: the neighbour (to staff) or the team (to the neighbour) is typing. */
  | "support.typing"
  | "inbox.updated"
  | "queue.changed"
  | "session.changed";

export interface RealtimeEvent {
  type: RealtimeEventType;
  /** The changed thing's id (post, comment, notification, listing…). */
  id?: string;
  postId?: string;
  conversationId?: string;
  threadId?: string;
  groupId?: string;
  at: string;
}

/** Channels: one per person, one per Hood, one for all staff. */
export const channel = {
  user: (uid: string) => `user:${uid}`,
  hood: (hoodId: string) => `hood:${hoodId}`,
  staff: "staff",
} as const;
