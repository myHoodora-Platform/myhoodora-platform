import type { User } from "firebase/auth";
import { ApiError, apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";

export const SUPPORT_TOPICS = [
  { id: "account", label: "My account" },
  { id: "verification", label: "Address verification" },
  { id: "safety", label: "A safety concern" },
  { id: "bug", label: "Something isn't working" },
  { id: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["id"];

// ── Support conversations (contract §18) ────────────────────────────────────

export type SupportStatus = "open" | "waiting" | "resolved";

export interface SupportMessage {
  from: "user" | "staff";
  body: string;
  at: string;
  /** Staff member's name on team messages. */
  by?: string;
}

export interface SupportThread {
  id: string;
  subject: string;
  topic: string;
  status: SupportStatus;
  startedBy: "user" | "staff";
  messages: SupportMessage[];
  unread: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupportThreadSummary = Omit<SupportThread, "messages"> & { lastMessage?: SupportMessage };

// Preview mode keeps each account's threads in the mock store.
const mockKey = (uid: string) => `support-threads:${uid}`;
const mockThreads = (uid: string) => load<SupportThread[]>(mockKey(uid), () => []);
const topicLabel = (topic: string) => SUPPORT_TOPICS.find((t) => t.id === topic)?.label ?? "Help";

function summarise(t: SupportThread): SupportThreadSummary {
  const { messages, ...rest } = t;
  return { ...rest, lastMessage: messages[messages.length - 1] };
}

/**
 * live: POST /support { topic, message } → { id, status: "received" }.
 * Opens a conversation in the team inbox; it continues at /inbox/support/:id.
 */
export async function submitSupportRequest(user: User, input: { topic: SupportTopic; message: string }): Promise<{ id: string }> {
  if (isLive("support")) return apiFetch<{ id: string }>(user, "/support", { method: "POST", json: input });
  await latency(400);
  const now = new Date().toISOString();
  const thread: SupportThread = {
    id: mockId("sup"),
    subject: `${topicLabel(input.topic)} help request`,
    topic: input.topic,
    status: "open",
    startedBy: "user",
    messages: [{ from: "user", body: input.message, at: now }],
    unread: false,
    createdAt: now,
    updatedAt: now,
  };
  save(mockKey(user.uid), [thread, ...mockThreads(user.uid)]);
  return { id: thread.id };
}

/** live: GET /support/threads (newest first). */
export async function listSupportThreads(user: User): Promise<SupportThreadSummary[]> {
  if (isLive("support.threads")) return apiFetch(user, "/support/threads");
  await latency(150);
  return mockThreads(user.uid).map(summarise);
}

/** live: GET /support/threads/:id (marks it read). Someone else's thread is a 404. */
export async function getSupportThread(user: User, id: string): Promise<SupportThread> {
  if (isLive("support.threads")) return apiFetch(user, `/support/threads/${encodeURIComponent(id)}`);
  await latency(150);
  const all = mockThreads(user.uid);
  const t = all.find((x) => x.id === id);
  if (!t) throw new ApiError("We couldn't find that conversation.", 404, "not_found");
  if (t.unread) save(mockKey(user.uid), all.map((x) => (x.id === id ? { ...x, unread: false } : x)));
  return { ...t, unread: false };
}

/** live: POST /support/threads/:id/messages; reopens a resolved conversation. */
export async function replyToSupport(user: User, id: string, body: string): Promise<SupportThread> {
  if (isLive("support.threads")) return apiFetch(user, `/support/threads/${encodeURIComponent(id)}/messages`, { method: "POST", json: { body } });
  await latency(250);
  const now = new Date().toISOString();
  const all = mockThreads(user.uid);
  const t = all.find((x) => x.id === id);
  if (!t) throw new ApiError("We couldn't find that conversation.", 404, "not_found");
  const next: SupportThread = { ...t, status: "open", messages: [...t.messages, { from: "user", body, at: now }], updatedAt: now };
  save(mockKey(user.uid), [next, ...all.filter((x) => x.id !== id)]);
  return next;
}

/** live: GET /support/threads/unread-count → conversations with an unread team reply. */
export async function fetchSupportUnread(user: User): Promise<number> {
  if (isLive("support.threads")) return (await apiFetch<{ count: number }>(user, "/support/threads/unread-count")).count;
  return mockThreads(user.uid).filter((t) => t.unread).length;
}
