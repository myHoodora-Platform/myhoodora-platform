import { GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CommentsService } from "../comments/comments.service";
import { HoodsService } from "../hoods/hoods.service";
import { initials, postAccess } from "../posts/domain/visibility";
import { PostsService } from "../posts/posts.service";
import { FeedPost, type PostDocument } from "../posts/schemas/post.schema";
import { StorageService } from "../storage/storage.service";
import { UsersService } from "../users/users.service";

export interface PublicPostPreview {
  _id: string;
  mode: "full" | "teaser";
  hood: { id: string; name: string; city?: string };
  category: string;
  alertCategory?: string;
  createdAt: string;
  reactionTotal: number;
  commentCount: number;
  author: { name: string; kind?: "team" };
  message?: string;
  mediaUrls?: string[];
  mediaAspects?: (number | null)[];
  poll?: { options: { id: string; text: string }[]; closesAt: string };
  pollResults?: { counts: Record<string, number>; total: number; closed: boolean };
  eventDate?: string;
  eventLocation?: string;
  priceNaira?: number | null;
  replies?: { name: string; text: string; createdAt: string; kind?: "team" }[];
}

/**
 * GET /public/posts/:id: what someone who opened a shared link sees before signing in
 * (docs/product/hood-activation-plan.md §8). Same rules as for neighbours outside the post's
 * audience (posts/domain/visibility.ts): Anyone posts in full with initials only; everything else a
 * teaser with no text, photos, names or place. Nothing about the viewer is needed or kept.
 */
@Injectable()
export class PublicPostsService {
  constructor(
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    private readonly feed: PostsService,
    private readonly comments: CommentsService,
    private readonly hoods: HoodsService,
    private readonly users: UsersService,
    private readonly storage: StorageService,
  ) {}

  async preview(id: string): Promise<PublicPostPreview> {
    const p = Types.ObjectId.isValid(id) ? await this.posts.findById(id).lean<FeedPost & { _id: Types.ObjectId }>().exec() : null;
    if (!p) throw new NotFoundException("This post doesn't exist.");
    if (!p.isActive || p.removedAt || p.authorDeactivated) throw new GoneException("This post is no longer available.");
    const hood = (await this.hoods.findManyByIds([p.neighborhoodId])).get(p.neighborhoodId);
    if (!hood || hood.status === "archived") throw new GoneException("This post is no longer available.");

    const { message, meta } = this.feed.read(p);
    const access = postAccess(null, p);
    const counts = p.reactionCounts ?? {};
    const authors = await this.users.authorCards([p.authorUid]);
    const author = authors.get(p.authorUid);
    const base: PublicPostPreview = {
      _id: String(p._id),
      mode: access.read,
      hood: { id: String(hood._id), name: hood.name, city: hood.city },
      category: meta.category,
      ...(meta.category === "alert" && { alertCategory: meta.alertCategory ?? "other" }),
      createdAt: (p.createdAt ?? new Date()).toISOString(),
      reactionTotal: Object.values(counts).reduce((n, c) => n + (c ?? 0), 0),
      commentCount: p.commentCount ?? 0,
      // A teaser says nothing about who wrote it, not even initials (Nextdoor shows the subject only).
      author: author?.kind === "team" ? { name: author.displayName, kind: "team" } : { name: access.read === "full" ? initials(author?.displayName) : "A neighbour" },
    };
    if (access.read === "teaser") return base;

    const [aspects, polls, replies] = await Promise.all([
      this.storage.aspectRatios(p.mediaUrls ?? []),
      p.poll ? this.feed.pollResultsFor([p], "") : Promise.resolve(null),
      p.commentsDisabled ? Promise.resolve([]) : this.comments.firstReplies(String(p._id), 2),
    ]);
    const replyAuthors = await this.users.authorCards(replies.map((r) => r.authorUid));
    const results = polls?.get(String(p._id));
    return {
      ...base,
      message,
      mediaUrls: p.mediaUrls ?? [],
      mediaAspects: (p.mediaUrls ?? []).map((u) => aspects.get(u) ?? null),
      ...(meta.poll && { poll: meta.poll }),
      ...(results && { pollResults: { counts: results.counts, total: results.total, closed: results.closed } }),
      ...(meta.eventDate && { eventDate: meta.eventDate, eventLocation: meta.eventLocation }),
      ...(meta.category === "for_sale" && { priceNaira: meta.priceNaira ?? null }),
      replies: replies.map((r) => {
        const a = replyAuthors.get(r.authorUid);
        return a?.kind === "team"
          ? { name: a.displayName, text: r.content, createdAt: r.createdAt.toISOString(), kind: "team" as const }
          : { name: initials(a?.displayName), text: r.content, createdAt: r.createdAt.toISOString() };
      }),
    };
  }
}
