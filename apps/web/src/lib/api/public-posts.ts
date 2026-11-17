import type { PublicPostPreview } from "@myhoodora/api-contract/types";
import { API_BASE_URL, USE_MOCKS } from "./config";

export type SharedPostResult = { status: "ok"; post: PublicPostPreview } | { status: "gone" } | { status: "missing" } | { status: "unavailable" };

/**
 * live: GET /public/posts/:id, server-side, for the shared-link page and its link preview. No
 * sign-in, nothing about the visitor sent. Cached a minute (the API sends the same).
 */
export async function getSharedPost(id: string): Promise<SharedPostResult> {
  if (USE_MOCKS || !/^[0-9a-f]{24}$/i.test(id)) return { status: "missing" };
  try {
    const res = await fetch(`${API_BASE_URL}/public/posts/${id}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
    if (res.status === 404) return { status: "missing" };
    if (res.status === 410) return { status: "gone" };
    if (!res.ok) return { status: "unavailable" };
    return { status: "ok", post: (await res.json()) as PublicPostPreview };
  } catch {
    // The API asleep or unreachable: the page still invites them in.
    return { status: "unavailable" };
  }
}

const CATEGORY_WORDS: Record<string, string> = {
  general: "an update",
  recommendation: "a recommendation request",
  for_sale: "something for sale",
  alert: "a safety alert",
  event: "an event",
  lost_found: "a lost & found post",
  thanks: "a thank-you",
  poll: "a poll",
};

/** "a recommendation request" — what kind of post it is, in words, for teasers and link previews. */
export function postKindWords(category: string): string {
  return CATEGORY_WORDS[category] ?? "a post";
}

/** One line for the link preview: the text (full), or what kind of post it is (teaser). */
export function previewLine(p: PublicPostPreview, max = 150): string {
  if (p.mode === "full" && p.message) {
    const text = p.message.replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }
  return `A neighbour in ${p.hood.name} shared ${postKindWords(p.category)}. Join your neighbours on myHoodora to see it.`;
}
