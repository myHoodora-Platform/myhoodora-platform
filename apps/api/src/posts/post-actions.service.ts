import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { Viewer } from "../shared/auth/viewer";
import { AccountLifecycle } from "../users/account-lifecycle";
import { encodePostContent } from "./domain/post-meta";
import { PostsService, type PostView } from "./posts.service";
import { FeedPost, PostFollow, PostShare, SavedPost, type PostDocument } from "./schemas/post.schema";

/** Edits kept for moderators per post. */
const EDIT_HISTORY = 20;
export const POST_MAX = 8192;

/**
 * What a neighbour does to a post from its ⋯ menu besides reacting (contract §1): save it for later,
 * turn its notifications on or off, share it (counted once per neighbour), and edit their own.
 */
@Injectable()
export class PostActionsService implements OnModuleInit {
  constructor(
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    @InjectModel(SavedPost.name) private readonly saves: Model<SavedPost>,
    @InjectModel(PostFollow.name) private readonly follows: Model<PostFollow>,
    @InjectModel(PostShare.name) private readonly shares: Model<PostShare>,
    private readonly feed: PostsService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    // Their saves and notification choices go with them; shares they made stay counted.
    this.accounts.register({
      name: "post-actions",
      purge: async (uid, dryRun) => {
        if (dryRun) return { savedPosts: await this.saves.countDocuments({ uid }).exec(), postFollows: await this.follows.countDocuments({ uid }).exec() };
        const [s, f] = await Promise.all([this.saves.deleteMany({ uid }).exec(), this.follows.deleteMany({ uid }).exec()]);
        return { savedPosts: s.deletedCount, postFollows: f.deletedCount };
      },
    });
  }

  /** Save or unsave (repeating either is harmless). Any post they can read. */
  async setSaved(viewer: Viewer, id: string, saved: boolean): Promise<{ saved: boolean }> {
    if (saved) {
      const p = await this.feed.loadReadable(viewer, id);
      await this.saves.updateOne({ uid: viewer.uid, postId: String(p._id) }, { $setOnInsert: { uid: viewer.uid, postId: String(p._id) } }, { upsert: true }).exec();
    } else {
      // Unsaving works even once the post is gone, so it can be cleared from the list.
      await this.saves.deleteOne({ uid: viewer.uid, postId: id }).exec();
    }
    return { saved };
  }

  /**
   * Their saved posts, newest saved first, paged by `before` (the `savedAt` of the last one). Posts that
   * are gone or that they can no longer read are left out (the save stays, in case it comes back).
   */
  async listSaved(viewer: Viewer, q: { limit: number; before?: string }): Promise<(PostView & { savedAt: string })[]> {
    const rows = await this.saves
      .find({ uid: viewer.uid, ...(q.before && { createdAt: { $lt: new Date(q.before) } }) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit)
      .lean<(SavedPost & { createdAt: Date })[]>()
      .exec();
    if (!rows.length) return [];
    const staff = viewer.capabilities.includes("admin.access");
    const hidden = await this.feed.hiddenAuthors(viewer);
    const docs = await this.posts
      .find({
        _id: { $in: rows.map((r) => new Types.ObjectId(r.postId)) },
        ...(!staff && { isActive: true, removedAt: null, authorDeactivated: { $ne: true }, neighborhoodId: { $in: viewer.readableHoodIds }, ...(hidden.length && { authorUid: { $nin: hidden } }) }),
      })
      .lean<(FeedPost & { _id: Types.ObjectId })[]>()
      .exec();
    const views = new Map((await this.feed.toViews(docs, viewer)).map((v) => [v._id, v]));
    return rows.flatMap((r) => {
      const v = views.get(r.postId);
      return v ? [{ ...v, savedAt: r.createdAt.toISOString() }] : [];
    });
  }

  /**
   * Turn this post's notifications on (follow: hear about new comments) or off (mute: hear nothing
   * more from it, even as its author). Repeating is harmless.
   */
  async setFollowing(viewer: Viewer, id: string, on: boolean): Promise<{ following: boolean }> {
    const p = await this.feed.loadReadable(viewer, id);
    await this.follows.updateOne({ postId: String(p._id), uid: viewer.uid }, { $set: { on } }, { upsert: true }).exec();
    return { following: on };
  }

  /**
   * Counts a share: once per neighbour, however many times they share it. Returns the count, so the
   * client can show it without reloading the post.
   */
  async share(viewer: Viewer, id: string): Promise<{ shareCount: number }> {
    const p = await this.feed.loadReadable(viewer, id);
    const postId = String(p._id);
    const res = await this.shares.updateOne({ postId, uid: viewer.uid }, { $setOnInsert: { postId, uid: viewer.uid } }, { upsert: true }).exec();
    if (res.upsertedCount) {
      await this.posts.updateOne({ _id: p._id }, { $inc: { shareCount: 1 } }).exec();
      this.feed.changed(p);
    }
    const now = await this.posts.findById(p._id).select({ shareCount: 1 }).lean<Pick<FeedPost, "shareCount">>().exec();
    return { shareCount: now?.shareCount ?? 0 };
  }

  /**
   * The author changes their post's text (photos, kind and details stay as posted). Shown as "Edited";
   * the earlier text is kept for moderators. Removed posts can't be edited (they 404 like any other).
   */
  async edit(viewer: Viewer, id: string, input: { message: string }): Promise<PostView> {
    const p = await this.feed.loadVisible(viewer, id);
    if (p.authorUid !== viewer.uid) throw new ForbiddenException("You can only edit your own posts.");
    const message = input.message.trim();
    if (!message) throw new BadRequestException("Write something first.");
    if (message.length > POST_MAX) throw new BadRequestException("Posts can be up to 8,192 characters.");
    const { message: before, meta } = this.feed.read(p);
    if (message === before) return (await this.feed.toViews([p], viewer))[0]!;

    const at = new Date();
    const updated = await this.posts
      .findOneAndUpdate(
        { _id: p._id, authorUid: viewer.uid },
        { $set: { message, content: encodePostContent(message, meta), editedAt: at }, $push: { editHistory: { $each: [{ message: before, at }], $slice: -EDIT_HISTORY } } },
        { returnDocument: "after" },
      )
      .lean<FeedPost & { _id: Types.ObjectId }>()
      .exec();
    this.feed.changed(p);
    return (await this.feed.toViews([updated ?? p], viewer))[0]!;
  }
}
