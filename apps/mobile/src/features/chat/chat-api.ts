import type { User } from "@firebase/auth";
import type { Conversation, ForwardResult, Listing, Message, MuteLength, PinLength } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export const chatKeys = {
  all: ["conversations"] as const,
  list: (archived: boolean) => ["conversations", "list", archived ? "archived" : "inbox"] as const,
  requests: ["conversations", "list", "requests"] as const,
  unread: ["conversations", "unread"] as const,
  one: (id: string) => ["conversations", id] as const,
  messages: (id: string) => ["conversations", id, "messages"] as const,
};

/** Your inbox, newest first; or only the ones you archived. */
export function listConversations(user: User, archived = false): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(user, `/conversations${archived ? "?archived=true" : ""}`);
}

/** Out of your inbox (or back in). A new message brings it back by itself. */
export function archiveConversation(user: User, id: string, archived: boolean): Promise<void> {
  return apiFetch<void>(user, `/conversations/${id}/archive`, { method: "PUT", json: { archived } });
}

/** No notifications from it for 8 hours, a week, until turned back on, or not at all ("off"). */
export function muteConversation(user: User, id: string, length: MuteLength): Promise<{ mutedUntil: string | null }> {
  return apiFetch(user, `/conversations/${id}/mute`, { method: "PUT", json: { for: length } });
}

/** Delete for you: gone from your inbox, earlier messages hidden from you. They keep theirs. */
export function deleteConversation(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/conversations/${id}`, { method: "DELETE" });
}

/** Unread in your inbox (requests aren't counted), and message requests waiting (2026-10-29; absent from older APIs). */
export function unreadMessages(user: User): Promise<{ count: number; requests?: number }> {
  return apiFetch<{ count: number; requests?: number }>(user, "/conversations/unread-count");
}

/** Message requests: new chats from people you've never written to, waiting for you. */
export function listRequests(user: User): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(user, "/conversations?requests=true");
}

/** Accept a request: into your inbox; they see "Seen" from now on. Replying accepts it too. */
export function acceptRequest(user: User, id: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/request`, { method: "PUT" });
}

// ── Groups (2026-10-29) ──

/** A group chat: a name and up to 49 neighbours who accept messages from you. You're its admin. */
export function createGroupChat(user: User, title: string, memberUids: string[]): Promise<Conversation> {
  return apiFetch<Conversation>(user, "/conversations/groups", { method: "POST", json: { title, memberUids } });
}

/** A community Group's own chat (made the first time). Its members are the Group's. */
export function openGroupChat(user: User, groupId: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/for-group/${groupId}`, { method: "POST" });
}

export function renameGroupChat(user: User, id: string, title: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}`, { method: "PATCH", json: { title } });
}

export function addGroupMembers(user: User, id: string, uids: string[]): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/members`, { method: "POST", json: { uids } });
}

export function removeGroupMember(user: User, id: string, uid: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/members/${encodeURIComponent(uid)}`, { method: "DELETE" });
}

export function setGroupAdmin(user: User, id: string, uid: string, admin: boolean): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/admins/${encodeURIComponent(uid)}`, { method: "PUT", json: { admin } });
}

export function leaveGroupChat(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/conversations/${id}/leave`, { method: "POST" });
}

export const isGroupChat = (c: Pick<Conversation, "kind">) => c.kind === "group";

export function getConversation(user: User, id: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}`);
}

/** The newest page, oldest first. Opening it marks the thread read (contract §5). */
export function listMessages(user: User, id: string): Promise<Message[]> {
  return apiFetch<Message[]>(user, `/conversations/${id}/messages`);
}

/** Idempotent: the same pair (and listing) always gets the same thread back. */
export function startConversation(user: User, recipientUid: string, listing?: Pick<Listing, "_id">): Promise<Conversation> {
  return apiFetch<Conversation>(user, "/conversations", { method: "POST", json: { recipientUid, ...(listing && { context: { type: "listing", id: listing._id } }) } });
}

/** `POST /conversations/:id/typing`: ephemeral, tells the other person you're typing (contract §19). */
export function sendTyping(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/conversations/${id}/typing`, { method: "POST" });
}

/** Text, photos (up to 4, uploaded for messages), or both. */
export function sendMessage(user: User, id: string, body: string, photos: string[] = [], replyTo?: string): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages`, { method: "POST", json: { body, ...(photos.length && { photos }), ...(replyTo && { replyTo }) } });
}

/** One emoji per person; `null` takes yours back (contract §5). */
export function reactToMessage(user: User, id: string, messageId: string, emoji: string | null): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages/${messageId}/reaction`, { method: "PUT", json: { emoji } });
}

/** Your own message's words, within 15 minutes. */
export function editMessage(user: User, id: string, messageId: string, body: string): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages/${messageId}`, { method: "PATCH", json: { body } });
}

/** Delete for everyone: your own message, within an hour. */
export function deleteMessage(user: User, id: string, messageId: string): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages/${messageId}`, { method: "DELETE" });
}

/** Delete for me: gone for you only, whoever sent it. */
export function hideMessage(user: User, id: string, messageId: string): Promise<void> {
  return apiFetch<void>(user, `/conversations/${id}/messages/${messageId}/hidden`, { method: "PUT" });
}

/** To up to 5 chats or neighbours (one, for a message forwarded many times). Each succeeds or fails alone. */
export function forwardMessage(user: User, id: string, messageId: string, to: { conversationIds: string[]; recipientUids: string[] }): Promise<ForwardResult> {
  return apiFetch<ForwardResult>(user, `/conversations/${id}/messages/${messageId}/forward`, { method: "POST", json: to });
}

/** To the top of your inbox (or off it): up to 3, only you see it. A fourth is a 409 saying so. */
export function pinConversation(user: User, id: string, pinned: boolean): Promise<{ pinned: boolean }> {
  return apiFetch(user, `/conversations/${id}/pin`, { method: "PUT", json: { pinned } });
}

/** Pinned for everyone in the chat, for 24 hours, 7 or 30 days; a fourth replaces the oldest. */
export function pinMessage(user: User, id: string, messageId: string, length: PinLength): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/messages/${messageId}/pin`, { method: "PUT", json: { for: length } });
}

export function unpinMessage(user: User, id: string, messageId: string): Promise<Conversation> {
  return apiFetch<Conversation>(user, `/conversations/${id}/messages/${messageId}/pin`, { method: "DELETE" });
}

/** WhatsApp's three lengths, in its words. */
export const PIN_CHOICES: { length: PinLength; label: string; done: string }[] = [
  { length: "24h", label: "24 hours", done: "Pinned for 24 hours." },
  { length: "7d", label: "7 days", done: "Pinned for 7 days." },
  { length: "30d", label: "30 days", done: "Pinned for 30 days." },
];

/** "Buying & selling": conversations about a listing. */
export const aboutListing = (c: Conversation) => c.context?.type === "listing";

export const isMuted = (c: Pick<Conversation, "mutedUntil">, now = Date.now()) => !!c.mutedUntil && new Date(c.mutedUntil).getTime() > now;

/** The other person in a thread. */
export function otherPerson(c: Conversation, me: string) {
  return c.participants?.find((p) => p.uid !== me);
}
