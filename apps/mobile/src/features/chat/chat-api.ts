import type { User } from "@firebase/auth";
import type { Conversation, Listing, Message } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export const chatKeys = {
  all: ["conversations"] as const,
  unread: ["conversations", "unread"] as const,
  one: (id: string) => ["conversations", id] as const,
  messages: (id: string) => ["conversations", id, "messages"] as const,
};

export function listConversations(user: User): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(user, "/conversations");
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

export function sendMessage(user: User, id: string, body: string): Promise<Message> {
  return apiFetch<Message>(user, `/conversations/${id}/messages`, { method: "POST", json: { body } });
}
