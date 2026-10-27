import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type ClientSession, type QueryFilter } from "mongoose";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { NotificationsService } from "../notifications/notifications.service";
import { PostsService } from "../posts/posts.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { THREAD_PAGE_MAX } from "../shared/http/pagination";
import { RealtimeService } from "../realtime/realtime.service";
import { AccountLifecycle } from "../users/account-lifecycle";
import { UsersService } from "../users/users.service";
import { Comment, CommentDocument, CommentLike, CommentLikeDocument } from "./comment.schema";

export type CommentSort = "top" | "newest" | "oldest";

export interface CommentView {
  _id: string;
  postId: string;
  authorUid: string;
  author: { uid: string; displayName: string; photoURL?: string };
  content: string;
  createdAt: string;
  likes: string[];
  /** Set on a reply: the top-level comment it sits under, and whom it answers. */
  parentId?: string;
  replyToUid?: string;
  likeCount: number;
  replyCount: number;
  /** Whether the viewer likes it. */
  liked: boolean;
  /** A top-level comment that was deleted but still has replies: shown as a placeholder, never its words. */
  deleted?: boolean;
}

/** Query for the threaded view (`thread`); without it, the old flat list. */
export interface ThreadQuery {
  before?: string;
  limit?: number;
  /** "root" for top-level comments, or a top-level comment's id for its replies. */
  thread?: string;
  sort?: CommentSort;
  offset?: number;
}

/** Comments per page in the threaded view (default, and most). */
const THREAD_PAGE = 20;
const THREAD_PAGE_LIMIT = 100;

/** "Most relevant": a reply counts for more than a like (it's a conversation), then the newest. */
const RELEVANCE = { $add: [{ $multiply: [{ $ifNull: ["$likeCount", 0] }, 2] }, { $multiply: [{ $ifNull: ["$replyCount", 0] }, 3] }] };

type Row = Comment & { _id: Types.ObjectId };

@Injectable()
export class CommentsService implements OnModuleInit {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<CommentDocument>,
    @InjectModel(CommentLike.name) private readonly likes: Model<CommentLikeDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly posts: PostsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly registry: ModerationRegistry,
    private readonly realtime: RealtimeService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.accounts.register({ name: "comments", purge: (uid, dryRun) => this.purgeAuthor(uid, dryRun) });
    this.registry.register({
      type: "comment",
      load: async (id) => {
        const c = Types.ObjectId.isValid(id) ? await this.comments.findById(id).lean<Comment>().exec() : null;
        if (!c) return null;
        const post = await this.posts.findRaw(c.postId);
        return {
          type: "comment",
          id,
          preview: c.content.slice(0, 200),
          authorUid: c.authorUid,
          hoodId: post?.neighborhoodId,
          removed: Boolean(c.removedAt),
          content: { kind: "comment", message: c.content, createdAt: c.createdAt?.toISOString(), onPost: { id: c.postId, message: post ? this.posts.read(post).message.slice(0, 200) : "" }, removed: Boolean(c.removedAt) },
        };
      },
      setRemoved: async (id, removed, _actor, session) => {
        const c = await this.comments.findById(id).session(session ?? null).exec();
        if (!c || Boolean(c.removedAt) === removed) return;
        c.removedAt = removed ? new Date() : null;
        await c.save({ session });
        if (!c.deletedAt) {
          await this.posts.incCommentCount(c.postId, removed ? -1 : 1, session);
          if (c.parentId) await this.comments.updateOne({ _id: c.parentId }, { $inc: { replyCount: removed ? -1 : 1 } }, { session }).exec();
        }
      },
      announce: async (id) => {
        const c = Types.ObjectId.isValid(id) ? await this.comments.findById(id).lean<Comment>().exec() : null;
        const post = c ? await this.posts.findRaw(c.postId) : null;
        if (c && post) this.announce(post, c.removedAt || c.deletedAt ? "comment.deleted" : "comment.created", id);
      },
    });
  }

  /**
   * A page of the thread, oldest first: the newest comments, or with `before` the ones just earlier
   * than that comment. (It used to be the oldest 500 with no way past them, so on a busy post new
   * comments were stored and never shown.)
   */
  async list(viewer: Viewer, postId: string, q: ThreadQuery = {}): Promise<CommentView[]> {
    // Reading a thread is open to secondary Hoods too; writing in it isn't (create uses loadVisible).
    await this.posts.loadReadable(viewer, postId);
    if (q.thread) return this.listThread(viewer, postId, q);
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const filter: QueryFilter<Comment> = { postId, deletedAt: null, removedAt: null, ...(hidden.length && { authorUid: { $nin: hidden } }) };
    if (q.before) {
      // The cursor may since have been deleted or removed: it still marks a place in the thread.
      const cursor = await this.comments.findOne({ _id: q.before, postId }).select({ createdAt: 1 }).lean<Pick<Comment, "createdAt"> & { _id: Types.ObjectId }>().exec();
      if (!cursor) return [];
      filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
    }
    const newestFirst = await this.comments
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit ?? THREAD_PAGE_MAX)
      .lean<(Comment & { _id: Types.ObjectId })[]>()
      .exec();
    return this.toViews(newestFirst.reverse(), viewer.uid);
  }

  /**
   * The threaded view (contract §2): top-level comments, sorted "top" (most relevant), "newest" or
   * "oldest", or one comment's replies, oldest first. Paged by `offset`; a full page means there may be
   * more. A deleted comment that still has replies stays as a placeholder so its replies make sense.
   */
  private async listThread(viewer: Viewer, postId: string, q: ThreadQuery): Promise<CommentView[]> {
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const limit = Math.min(q.limit ?? THREAD_PAGE, THREAD_PAGE_LIMIT);
    const notHidden = hidden.length ? { authorUid: { $nin: hidden } } : {};
    if (q.thread !== "root") {
      const replies = await this.comments
        .find({ postId, parentId: q.thread, deletedAt: null, removedAt: null, ...notHidden })
        .sort({ createdAt: 1, _id: 1 })
        .skip(q.offset ?? 0)
        .limit(limit)
        .lean<Row[]>()
        .exec();
      return this.toViews(replies, viewer.uid);
    }
    const match = { postId, parentId: null, ...notHidden, $or: [{ deletedAt: null, removedAt: null }, { replyCount: { $gt: 0 } }] };
    const sort = q.sort ?? "top";
    const order = sort === "oldest" ? { createdAt: 1 as const, _id: 1 as const } : { createdAt: -1 as const, _id: -1 as const };
    const rows =
      sort === "top"
        ? await this.comments.aggregate<Row>([{ $match: match }, { $addFields: { relevance: RELEVANCE } }, { $sort: { relevance: -1, ...order } }, { $skip: q.offset ?? 0 }, { $limit: limit }]).exec()
        : await this.comments.find(match).sort(order).skip(q.offset ?? 0).limit(limit).lean<Row[]>().exec();
    return this.toViews(rows, viewer.uid);
  }

  /**
   * A comment, or with `parentId` a reply (one level: replying to a reply joins the same thread and
   * names whom it answers). `clientId` makes it safe to send twice: the second gets the first back.
   */
  async create(viewer: Viewer, postId: string, input: string | { content: string; parentId?: string; clientId?: string }): Promise<CommentView> {
    const { content, parentId, clientId } = typeof input === "string" ? { content: input } : input;
    const earlier = clientId ? await this.findByClientId(viewer.uid, clientId) : null;
    if (earlier) return (await this.toViews([earlier], viewer.uid))[0]!;

    const post = await this.posts.loadVisible(viewer, postId);
    if (post.commentsDisabled) throw new ForbiddenException("Comments are turned off for this post.");
    const text = content.trim();
    if (!text) throw new BadRequestException("Write a comment first.");
    const parent = parentId ? await this.comments.findOne({ _id: parentId, postId, deletedAt: null, removedAt: null }).lean<Row>().exec() : null;
    if (parentId && !parent) throw new NotFoundException("That comment isn't there any more.");
    const rootId = parent ? (parent.parentId ?? String(parent._id)) : undefined;

    let created: CommentDocument;
    try {
      created = await withTransaction(this.connection, async (session: ClientSession) => {
        const [c] = await this.comments.create([{ postId, authorUid: viewer.uid, content: text, clientId, ...(parent && { parentId: rootId, replyToUid: parent.authorUid }) }], { session });
        await this.posts.incCommentCount(postId, 1, session);
        if (rootId) await this.comments.updateOne({ _id: rootId }, { $inc: { replyCount: 1 } }, { session }).exec();
        return c!;
      });
    } catch (err) {
      // The same submission twice at once: the other one made it.
      const winner = clientId && (err as { code?: number }).code === 11000 ? await this.findByClientId(viewer.uid, clientId) : null;
      if (!winner) throw err;
      return (await this.toViews([winner], viewer.uid))[0]!;
    }

    const who = viewer.displayName ?? "A neighbour";
    const body = text.slice(0, 140);
    const href = `/p/${postId}`;
    // Whoever was answered (and whoever started the thread) hears about the reply; the post's author hears about anything new on it.
    const answered = parent ? [...new Set([parent.authorUid, ...(rootId !== String(parent._id) ? [await this.authorOf(rootId!)] : [])])].filter((u): u is string => !!u) : [];
    if (answered.length) await this.notifications.notify({ uids: answered, type: "comment", actorUid: viewer.uid, title: `${who} replied to your comment`, body, href, category: "comments" });
    if (!answered.includes(post.authorUid)) {
      await this.notifications.notify({ uids: [post.authorUid], type: "comment", actorUid: viewer.uid, title: parent ? `${who} replied to a comment on your post` : `${who} commented on your post`, body, href, category: "comments" });
    }
    this.announce(post, "comment.created", String(created._id));
    return (await this.toViews([created.toObject()], viewer.uid))[0]!;
  }

  /**
   * Like or unlike a comment (one like per neighbour; repeating either is harmless). Liking is a
   * reaction, so it's for the post's home Hood, like reacting to the post itself.
   */
  async setLiked(viewer: Viewer, id: string, liked: boolean): Promise<{ likeCount: number; liked: boolean }> {
    const c = Types.ObjectId.isValid(id) ? await this.comments.findOne({ _id: id, deletedAt: null, removedAt: null }).lean<Row>().exec() : null;
    if (!c) throw new NotFoundException("Comment not found.");
    await this.posts.loadVisible(viewer, c.postId);
    const changed = await withTransaction(this.connection, async (session) => {
      if (liked) {
        const res = await this.likes.updateOne({ commentId: id, uid: viewer.uid }, { $setOnInsert: { commentId: id, uid: viewer.uid } }, { upsert: true, session }).exec();
        if (!res.upsertedCount) return false;
      } else {
        const res = await this.likes.deleteOne({ commentId: id, uid: viewer.uid }, { session }).exec();
        if (!res.deletedCount) return false;
      }
      await this.comments.updateOne({ _id: id }, { $inc: { likeCount: liked ? 1 : -1 } }, { session }).exec();
      return true;
    });
    if (changed && liked) {
      await this.notifications.notify({
        uids: [c.authorUid],
        type: "reaction",
        actorUid: viewer.uid,
        title: `${viewer.displayName ?? "A neighbour"} liked your comment`,
        body: c.content.slice(0, 140),
        href: `/p/${c.postId}`,
        category: "comments",
        groupKey: `comment-like:${id}`,
      });
    }
    const now = await this.comments.findById(id).select({ likeCount: 1 }).lean<Pick<Comment, "likeCount">>().exec();
    return { likeCount: Math.max(0, now?.likeCount ?? 0), liked };
  }

  private findByClientId(authorUid: string, clientId: string) {
    return this.comments.findOne({ authorUid, clientId }).lean<Row>().exec();
  }

  private async authorOf(commentId: string): Promise<string | undefined> {
    return (await this.comments.findById(commentId).select({ authorUid: 1 }).lean<Pick<Comment, "authorUid">>().exec())?.authorUid;
  }

  /** Author, or staff (Hood Leads later). */
  async delete(viewer: Viewer, id: string): Promise<void> {
    const c = Types.ObjectId.isValid(id) ? await this.comments.findById(id).exec() : null;
    if (!c || c.deletedAt) throw new NotFoundException("Comment not found.");
    const post = await this.posts.loadVisible(viewer, c.postId);
    if (c.authorUid !== viewer.uid && !viewer.capabilities.includes("moderation.act")) throw new ForbiddenException("You can only delete your own comments.");
    await withTransaction(this.connection, async (session) => {
      c.deletedAt = new Date();
      await c.save({ session });
      if (!c.removedAt) {
        await this.posts.incCommentCount(c.postId, -1, session);
        if (c.parentId) await this.comments.updateOne({ _id: c.parentId }, { $inc: { replyCount: -1 } }, { session }).exec();
      }
    });
    this.announce(post, "comment.deleted", id);
  }

  /**
   * An account is being deleted: their comments are deleted as if they had deleted each one, and
   * every post's comment count comes down by the ones that were still showing. One transaction, so
   * a retry can't take the counts down twice.
   */
  private async purgeAuthor(uid: string, dryRun: boolean): Promise<Record<string, number>> {
    const theirs = { authorUid: uid, deletedAt: null };
    if (dryRun) return { comments: await this.comments.countDocuments(theirs).exec() };
    return withTransaction(this.connection, async (session) => {
      const showing = await this.comments
        .aggregate<{ _id: string; n: number }>([{ $match: { ...theirs, removedAt: null } }, { $group: { _id: "$postId", n: { $sum: 1 } } }])
        .session(session)
        .exec();
      const repliesShowing = await this.comments
        .aggregate<{ _id: string; n: number }>([{ $match: { ...theirs, removedAt: null, parentId: { $type: "string" } } }, { $group: { _id: "$parentId", n: { $sum: 1 } } }])
        .session(session)
        .exec();
      const res = await this.comments.updateMany(theirs, { $set: { deletedAt: new Date() } }, { session }).exec();
      for (const post of showing) await this.posts.incCommentCount(post._id, -post.n, session);
      for (const parent of repliesShowing) await this.comments.updateOne({ _id: parent._id }, { $inc: { replyCount: -parent.n } }, { session }).exec();
      // Their likes go too, and the counts they added.
      const liked = await this.likes.find({ uid }).select({ commentId: 1 }).session(session).lean<Pick<CommentLike, "commentId">[]>().exec();
      if (liked.length) {
        await this.comments.updateMany({ _id: { $in: liked.map((l) => l.commentId) } }, { $inc: { likeCount: -1 } }, { session }).exec();
        await this.likes.deleteMany({ uid }, { session }).exec();
      }
      return { comments: res.modifiedCount, commentLikes: liked.length };
    });
  }

  /** Live update for the post's thread, and its comment count on feed cards. */
  private announce(post: { _id: unknown; neighborhoodId?: string | null }, type: "comment.created" | "comment.deleted", id: string): void {
    this.realtime.toHood(post.neighborhoodId, type, { id, postId: String(post._id) });
    this.posts.changed(post);
  }

  /** For admin post detail (includes removed). */
  async allForPost(postId: string) {
    return this.comments.find({ postId, deletedAt: null }).sort({ createdAt: 1 }).lean<(Comment & { _id: Types.ObjectId })[]>().exec();
  }

  private async toViews(rows: (Comment & { _id: unknown })[], viewerUid?: string): Promise<CommentView[]> {
    const ids = rows.map((r) => String(r._id));
    const [authors, mine] = await Promise.all([
      this.users.authorCards(rows.map((r) => r.authorUid)),
      viewerUid && ids.length ? this.likes.find({ uid: viewerUid, commentId: { $in: ids } }).select({ commentId: 1 }).lean<Pick<CommentLike, "commentId">[]>().exec() : [],
    ]);
    const likedIds = new Set(mine.map((l) => l.commentId));
    return rows.map((r) => {
      const a = authors.get(r.authorUid);
      const gone = Boolean(r.deletedAt || r.removedAt);
      return {
        _id: String(r._id),
        postId: r.postId,
        authorUid: gone ? "" : r.authorUid,
        author: gone ? { uid: "", displayName: "" } : { uid: r.authorUid, displayName: a?.displayName ?? "Neighbour", photoURL: a?.photoURL },
        content: gone ? "" : r.content,
        createdAt: (r.createdAt ?? new Date()).toISOString(),
        likes: [],
        ...(r.parentId && { parentId: r.parentId, replyToUid: r.replyToUid }),
        likeCount: Math.max(0, r.likeCount ?? 0),
        replyCount: Math.max(0, r.replyCount ?? 0),
        liked: likedIds.has(String(r._id)),
        ...(gone && { deleted: true }),
      };
    });
  }
}
