import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { searchNeighbours } from "./groups";
import { listListings } from "./listings";
import { hydratePost, listFeed } from "./posts";
import type { ApiPost, Listing, Post, PublicProfile } from "./types";
import { rememberAuthor } from "./users";

export type SearchType = "posts" | "listings" | "people";

export interface HoodSearchResults {
  posts?: Post[];
  listings?: Listing[];
  people?: PublicProfile[];
}

/**
 * live: GET /search?q&type → { q, posts?, listings?, people? }, the caller's
 * own Hood only (same visibility as the feed, For Sale & Free and neighbour
 * search). Without `type`, a few of each.
 */
export async function searchHood(user: User, neighborhoodId: string, q: string, type?: SearchType): Promise<HoodSearchResults> {
  if (isLive("search")) {
    const params = new URLSearchParams({ q });
    if (type) params.set("type", type);
    const raw = await apiFetch<{ posts?: ApiPost[]; listings?: Listing[]; people?: PublicProfile[] }>(user, `/search?${params}`);
    raw.listings?.forEach((l) => rememberAuthor(l.seller));
    raw.people?.forEach(rememberAuthor);
    return { posts: raw.posts?.map((d) => hydratePost(d, user.uid)), listings: raw.listings, people: raw.people };
  }
  // Mock: filter the same lists the pages use.
  const needle = q.trim().toLowerCase();
  const n = type ? 20 : 5;
  const want = (t: SearchType) => !type || type === t;
  const [posts, listings, people] = await Promise.all([
    want("posts") ? listFeed(user, neighborhoodId, { limit: 50 }) : undefined,
    want("listings") ? listListings(user, neighborhoodId) : undefined,
    want("people") ? searchNeighbours(user, q) : undefined,
  ]);
  return {
    posts: posts?.filter((p) => p.message.toLowerCase().includes(needle)).slice(0, n),
    listings: listings?.filter((l) => `${l.title} ${l.description ?? ""}`.toLowerCase().includes(needle)).slice(0, n),
    people: people?.slice(0, n),
  };
}
