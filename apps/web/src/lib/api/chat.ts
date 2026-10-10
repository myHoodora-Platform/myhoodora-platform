import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";
import { seedConversations } from "./mock/seed";
import type { Conversation, ConversationContext, Message } from "./types";
import { rememberAuthor } from "./users";

function withPeople<T extends Conversation | Conversation[]>(value: T): T {
  (Array.isArray(value) ? value : [value]).forEach((c) => c.participants?.forEach(rememberAuthor));
  return value;
}

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
}

const key = (uid: string) => `chat:${uid}`;
const state = (uid: string) => load<ChatState>(key(uid), () => seedConversations(uid));

/** live: GET /conversations — newest activity first, with unreadCount. */
export async function listConversations(user: User): Promise<Conversation[]> {
  if (isLive("chat")) return withPeople(await apiFetch<Conversation[]>(user, "/conversations"));
  await latency();
  return [...state(user.uid).conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** live: GET /conversations/unread-count → { count } (header badge). */
export async function fetchUnreadTotal(user: User): Promise<number> {
  if (!isLive("chat")) return unreadTotal(user.uid);
  return (await apiFetch<{ count: number }>(user, "/conversations/unread-count")).count;
}

/** Sync unread total for the header badge (preview only). */
export function unreadTotal(uid: string): number {
  if (typeof window === "undefined" || isLive("chat")) return 0;
  return state(uid).conversations.reduce((n, c) => n + c.unreadCount, 0);
}

/** live: GET /conversations/:id */
export async function getConversation(user: User, id: string): Promise<Conversation | null> {
  if (isLive("chat")) return withPeople(await apiFetch<Conversation>(user, `/conversations/${id}`));
  await latency(120);
  return state(user.uid).conversations.find((c) => c._id === id) ?? null;
}

/**
 * live: POST /conversations { recipientUid, context? } — returns the
 * existing thread if one already exists for this pair + context, so tapping
 * "Message seller" twice never creates duplicates.
 */
export async function startConversation(
  user: User,
  recipientUid: string,
  context?: ConversationContext,
): Promise<Conversation> {
  if (isLive("chat")) {
    return withPeople(await apiFetch<Conversation>(user, "/conversations", { method: "POST", json: { recipientUid, context } }));
  }
  await latency();
  const s = state(user.uid);
  const existing = s.conversations.find(
    (c) => c.participantUids.includes(recipientUid) && c.context?.id === context?.id,
  );
  if (existing) return existing;
  const convo: Conversation = {
    _id: mockId("mcv"),
    participantUids: [user.uid, recipientUid],
    context,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };
  save(key(user.uid), { ...s, conversations: [convo, ...s.conversations] });
  return convo;
}

/**
 * live: GET /conversations/:id/messages[?before=<message id>] — the newest
 * page (up to 500), oldest first; also marks as read. With `before`, the page
 * of messages older than that one (which doesn't mark anything read).
 */
export async function listMessages(user: User, conversationId: string, opts: { before?: string } = {}): Promise<Message[]> {
  if (isLive("chat")) {
    const query = opts.before ? `?before=${encodeURIComponent(opts.before)}` : "";
    return apiFetch<Message[]>(user, `/conversations/${conversationId}/messages${query}`);
  }
  await latency(150);
  const s = state(user.uid);
  // The mock store never holds more than one page, so there is nothing earlier.
  if (opts.before) return [];
  save(key(user.uid), {
    ...s,
    conversations: s.conversations.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)),
  });
  return s.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** live: POST /conversations/:id/messages { body } */
/** live: POST /conversations/:id/typing (ephemeral; preview mode has nobody to tell). */
export async function sendTyping(user: User, conversationId: string): Promise<void> {
  if (isLive("chat")) await apiFetch<void>(user, `/conversations/${conversationId}/typing`, { method: "POST" });
}

export async function sendMessage(user: User, conversationId: string, body: string): Promise<Message> {
  if (isLive("chat")) {
    return apiFetch<Message>(user, `/conversations/${conversationId}/messages`, { method: "POST", json: { body } });
  }
  await latency(200);
  const s = state(user.uid);
  const message: Message = {
    _id: mockId("mm"),
    conversationId,
    senderUid: user.uid,
    body,
    createdAt: new Date().toISOString(),
  };
  save(key(user.uid), {
    messages: [...s.messages, message],
    conversations: s.conversations.map((c) =>
      c._id === conversationId
        ? { ...c, lastMessage: { body, senderUid: user.uid, createdAt: message.createdAt }, updatedAt: message.createdAt }
        : c,
    ),
  });
  return message;
}
