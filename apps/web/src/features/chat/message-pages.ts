import type { Message } from "@/lib/api/types";

/**
 * How many messages the API returns at a time when no limit is asked for
 * (GET /conversations/:id/messages): the newest 500. A full page means there
 * may be earlier ones to fetch with `before`.
 */
export const MESSAGE_PAGE = 500;

/**
 * Add a fetched page to the messages already on screen: no duplicates, oldest
 * first. The thread refetches its newest page whenever something changes, and
 * that must not throw away earlier pages the reader has loaded.
 */
export function mergeMessages(current: Message[], page: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m._id, m]));
  for (const m of page) byId.set(m._id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
}
