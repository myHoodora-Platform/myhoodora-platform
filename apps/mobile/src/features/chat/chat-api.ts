import type { User } from "@firebase/auth";
import type { Conversation, Listing, Message, MuteLength } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export const chatKeys = {
  all: ["conversations"] as const,
  list: (archived: boolean) => ["conversations", "list", archived ? "archived" : "inbox"] as const,
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

export function unreadMessages(user: User): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(user, "/conversations/unread-count");
}

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
export function sendMessage(user: User, id: string, body: string, photos: string[] = []): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages`, { method: "POST", json: { body, ...(photos.length && { photos }) } });
}

/** "Buying & selling": conversations about a listing. */
export const aboutListing = (c: Conversation) => c.context?.type === "listing";

export const isMuted = (c: Pick<Conversation, "mutedUntil">, now = Date.now()) => !!c.mutedUntil && new Date(c.mutedUntil).getTime() > now;

/** The other person in a thread. */
export function otherPerson(c: Conversation, me: string) {
  return c.participants?.find((p) => p.uid !== me);
}
