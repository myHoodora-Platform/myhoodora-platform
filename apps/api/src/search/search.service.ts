import { Injectable } from "@nestjs/common";
import { ListingsService, type ListingView } from "../listings/listings.service";
import { PostsService, type PostView } from "../posts/posts.service";
import type { Viewer } from "../shared/auth/viewer";
import { UsersService, type PublicProfile } from "../users/users.service";

export const SEARCH_TYPES = ["posts", "listings", "people"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchResults {
  q: string;
  posts?: PostView[];
  listings?: ListingView[];
  people?: PublicProfile[];
}

/**
 * GET /search: the caller's own Hood only. Each type reuses the list it
 * comes from (feed, For Sale & Free, neighbour search), so visibility rules
 * (blocks, removed content, sold items, verification) stay in one place.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly posts: PostsService,
    private readonly listings: ListingsService,
    private readonly users: UsersService,
  ) {}

  async search(viewer: Viewer, q: string, type?: SearchType, limit?: number): Promise<SearchResults> {
    const want = (t: SearchType) => !type || type === t;
    // "All" shows a few of each; a single tab shows more.
    const n = limit ?? (type ? 20 : 5);
    if (!viewer.hoodId) return { q, ...(want("posts") && { posts: [] }), ...(want("listings") && { listings: [] }), ...(want("people") && { people: [] }) };
    const [posts, listings, people] = await Promise.all([
      want("posts") ? this.posts.feed(viewer, viewer.hoodId, { q, limit: n }) : undefined,
      want("listings") ? this.listings.list(viewer, { q, limit: n }) : undefined,
      want("people") ? this.users.search(viewer, q).then((rows) => rows.slice(0, n)) : undefined,
    ]);
    return { q, ...(posts && { posts }), ...(listings && { listings }), ...(people && { people }) };
  }
}
