import type { User } from "@firebase/auth";
import type { ApiPost, Listing, PublicProfile } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

export type SearchType = "all" | "posts" | "listings" | "people";

export interface SearchResults {
  q: string;
  posts?: ApiPost[];
  listings?: Listing[];
  people?: PublicProfile[];
}

/** The API's bounds for q (contract §21). */
export const SEARCH_MIN = 2;

/** `GET /search?q&type`: your Hood only. Without a type, up to 5 of each. */
export function search(user: User, q: string, type: SearchType): Promise<SearchResults> {
  const params = new URLSearchParams({ q: q.trim().slice(0, 100) });
  if (type !== "all") params.set("type", type);
  return apiFetch<SearchResults>(user, `/search?${params}`);
}
