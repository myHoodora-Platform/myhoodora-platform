import type { User } from "@firebase/auth";
import type { SupportThread, SupportThreadSummary, SupportTopic } from "@myhoodora/api-contract/support";
import { apiFetch } from "@/core/api/client";

/** Conversations with the myHoodora team (contract §18): your questions, and requests staff ask about. */
export const supportKeys = {
  all: ["support"] as const,
  list: ["support", "threads"] as const,
  unread: ["support", "unread"] as const,
  one: (id: string) => ["support", "thread", id] as const,
};

export function listSupportThreads(user: User): Promise<SupportThreadSummary[]> {
  return apiFetch<SupportThreadSummary[]>(user, "/support/threads");
}

export function supportUnread(user: User): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(user, "/support/threads/unread-count");
}

/** Opening a thread marks it read. Someone else's thread is a 404. */
export function getSupportThread(user: User, id: string): Promise<SupportThread> {
  return apiFetch<SupportThread>(user, `/support/threads/${id}`);
}

/** `POST /support/threads/:id/typing`: ephemeral, lets the team see you're typing. */
export function sendSupportTyping(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/support/threads/${encodeURIComponent(id)}/typing`, { method: "POST" });
}

export function replyToSupport(user: User, id: string, body: string): Promise<SupportThread> {
  return apiFetch<SupportThread>(user, `/support/threads/${id}/messages`, { method: "POST", json: { body } });
}

/** A new question to the team; the reply arrives in the same conversation. */
export function contactSupport(user: User, topic: SupportTopic, message: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(user, "/support", { method: "POST", json: { topic, message } });
}
