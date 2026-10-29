import { BadRequestException, Injectable } from "@nestjs/common";
import { HoodsService } from "../hoods/hoods.service";
import { ListingsService } from "../listings/listings.service";
import { PostsService, type PostView } from "../posts/posts.service";
import { StorageService } from "../storage/storage.service";
import { UsersService } from "../users/users.service";
import type { Viewer } from "../shared/auth/viewer";
import type { AdFeedQuery } from "./ads.dto";
import { AdsService, type AdView, type PromotedListing } from "./ads.service";
import { initialState, placeAds, type PlacementState } from "./domain/placement";

export type FeedItem = { type: "post"; data: PostView } | { type: "ad"; slotId: string; data: AdView };

interface Cursor {
  v: 1;
  /** The last post's createdAt: the next page starts before it. */
  before: string;
  state: PlacementState;
}

/** The cursor is opaque to the app: it carries where the next page starts and where its ads go. */
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    const s = c.state;
    const counts = s && typeof s.served === "object" && s.served !== null ? Object.values(s.served) : null;
    if (c.v !== 1 || Number.isNaN(Date.parse(c.before)) || !counts || ![s.seen, s.nextAt, s.slots, ...counts].every((n) => Number.isInteger(n) && n >= 0)) throw new Error("bad");
    return c;
  } catch {
    throw new BadRequestException("That page of the feed has expired. Refresh to start again.");
  }
}

/**
 * GET /feed/hood/:id: the neighbourhood feed with sponsored items placed among the posts
 * (docs/feed-redesign-spec.md §5.3). Same posts, order and access rules as GET /posts/neighborhood/:id,
 * which stays as it is for older app builds. Ads only in the full feed (no category filter).
 */
@Injectable()
export class AdFeedService {
  constructor(
    private readonly posts: PostsService,
    private readonly ads: AdsService,
    private readonly hoods: HoodsService,
    private readonly storage: StorageService,
    private readonly listings: ListingsService,
    private readonly users: UsersService,
  ) {}

  async page(viewer: Viewer, hoodId: string, q: AdFeedQuery): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;
    // Access, blocks and order are the plain feed's (404 outside your neighbourhoods).
    const posts = await this.posts.feed(viewer, hoodId, { limit: q.limit, before: cursor?.before, category: q.category });
    const more = posts.length === q.limit;
    const rules = await this.ads.settings();
    const state = cursor?.state ?? initialState(rules);

    let items: FeedItem[] = posts.map((p) => ({ type: "post", data: p }));
    let next = { ...state, seen: state.seen + posts.length };
    if (rules.enabled && !q.category && posts.length) {
      const hood = (await this.hoods.findManyByIds([hoodId])).get(hoodId);
      const [lng, lat] = hood?.location?.coordinates ?? [];
      const found = await this.ads.candidatesFor(viewer, { id: hoodId, city: hood?.city, lat, lng });
      const { ads } = found;
      const showsListings = (q.supports ?? "").split(",").includes("listings");
      const promoted = showsListings ? await this.promotedItems(viewer, [...ads.values()]) : new Map<string, never>();
      // A seller's ad with nothing for sale now (or a seller this neighbour hid) isn't shown.
      const candidates = found.candidates.filter((c) => ads.get(c.id)!.format !== "listings" || (showsListings && promoted.has(c.id)));
      const placed = placeAds(posts, candidates, state, { session: q.session, rules, more });
      next = placed.state;
      const placedAds = placed.items.flatMap((i) => (i.type === "ad" ? [ads.get(i.adId)!] : []));
      const aspects = await this.storage.aspectRatios(placedAds.flatMap((a) => a.media.map((m) => m.url)));
      items = placed.items.map((i) => (i.type === "post" ? i : { type: "ad", slotId: i.slotId, data: this.ads.toView(ads.get(i.adId)!, hood?.name, aspects, promoted.get(i.adId)) }));
    }
    const last = posts[posts.length - 1];
    return { items, nextCursor: more && last ? encodeCursor({ v: 1, before: last.createdAt, state: next }) : null };
  }

  /** For each `listings` ad: its seller and their items available now. Absent when there are none to show. */
  private async promotedItems(viewer: Viewer, ads: { _id: unknown; format: string; sellerUid?: string }[]) {
    const out = new Map<string, { seller: { uid: string; name: string; photoURL?: string }; listings: PromotedListing[]; total: number }>();
    const promos = ads.filter((a) => a.format === "listings" && a.sellerUid);
    if (!promos.length) return out;
    const hidden = new Set(await this.users.hiddenAuthorsFor(viewer.uid));
    await Promise.all(
      promos.map(async (a) => {
        if (hidden.has(a.sellerUid!)) return;
        const { items, total } = await this.listings.forPromotion(a.sellerUid!);
        const first = items[0];
        if (!first) return;
        out.set(String(a._id), {
          seller: { uid: first.seller.uid, name: first.seller.displayName, photoURL: first.seller.photoURL },
          listings: items.map((l) => ({ _id: l._id, title: l.title, priceNaira: l.priceNaira, negotiable: l.negotiable, photoUrl: l.photos[0] })),
          total,
        });
      }),
    );
    return out;
  }
}
