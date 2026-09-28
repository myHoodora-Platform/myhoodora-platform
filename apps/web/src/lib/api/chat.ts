import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";
import { seedConversations } from "./mock/seed";
import type { Conversation, ConversationContext, Message } from "./types";

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
}

const key = (uid: string) => `chat:${uid}`;
const state = (uid: string) => load<ChatState>(key(uid), () => seedConversations(uid));

/** planned: GET /conversations — newest activity first, with unreadCount. */
export async function listConversations(user: User): Promise<Conversation[]> {
  if (isLive("chat")) return apiFetch<Conversation[]>(user, "/conversations");
  await latency();
  return [...state(user.uid).conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Sync unread total for the header badge (preview). planned: GET /conversations/unread-count */
export function unreadTotal(uid: string): number {
  if (typeof window === "undefined" || isLive("chat")) return 0;
  return state(uid).conversations.reduce((n, c) => n + c.unreadCount, 0);
}

/** planned: GET /conversations/:id */
export async function getConversation(user: User, id: string): Promise<Conversation | null> {
  if (isLive("chat")) return apiFetch<Conversation>(user, `/conversations/${id}`);
  await latency(120);
  return state(user.uid).conversations.find((c) => c._id === id) ?? null;
}

/**
 * planned: POST /conversations { recipientUid, context? } — returns the
 * existing thread if one already exists for this pair + context, so tapping
 * "Message seller" twice never creates duplicates.
 */
export async function startConversation(
  user: User,
  recipientUid: string,
  context?: ConversationContext,
): Promise<Conversation> {
  if (isLive("chat")) {
    return apiFetch<Conversation>(user, "/conversations", { method: "POST", json: { recipientUid, context } });
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

/** planned: GET /conversations/:id/messages — oldest first. Also marks as read. */
export async function listMessages(user: User, conversationId: string): Promise<Message[]> {
  if (isLive("chat")) return apiFetch<Message[]>(user, `/conversations/${conversationId}/messages`);
  await latency(150);
  const s = state(user.uid);
  save(key(user.uid), {
    ...s,
    conversations: s.conversations.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)),
  });
  return s.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** planned: POST /conversations/:id/messages { body } */
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
