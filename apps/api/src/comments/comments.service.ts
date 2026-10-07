import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type ClientSession, type QueryFilter } from "mongoose";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { NotificationsService } from "../notifications/notifications.service";
import { PostsService } from "../posts/posts.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { THREAD_PAGE_MAX, type ThreadPageQuery } from "../shared/http/pagination";
import { RealtimeService } from "../realtime/realtime.service";
import { AccountLifecycle } from "../users/account-lifecycle";
import { UsersService } from "../users/users.service";
import { Comment, CommentDocument } from "./comment.schema";

export interface CommentView {
  _id: string;
  postId: string;
  authorUid: string;
  author: { uid: string; displayName: string; photoURL?: string };
  content: string;
  createdAt: string;
  likes: string[];
}

@Injectable()
export class CommentsService implements OnModuleInit {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<CommentDocument>,
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
        if (!c.deletedAt) await this.posts.incCommentCount(c.postId, removed ? -1 : 1, session);
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
  async list(viewer: Viewer, postId: string, q: ThreadPageQuery = {}): Promise<CommentView[]> {
    await this.posts.loadVisible(viewer, postId);
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
    return this.toViews(newestFirst.reverse());
  }

  async create(viewer: Viewer, postId: string, content: string): Promise<CommentView> {
    const post = await this.posts.loadVisible(viewer, postId);
    if (post.commentsDisabled) throw new ForbiddenException("Comments are turned off for this post.");
    const text = content.trim();
    if (!text) throw new BadRequestException("Write a comment first.");
    const created = await withTransaction(this.connection, async (session: ClientSession) => {
      const [c] = await this.comments.create([{ postId, authorUid: viewer.uid, content: text }], { session });
      await this.posts.incCommentCount(postId, 1, session);
      return c!;
    });
    await this.notifications.notify({
      uids: [post.authorUid],
      type: "comment",
      actorUid: viewer.uid,
      title: `${viewer.displayName ?? "A neighbour"} commented on your post`,
      body: text.slice(0, 140),
      href: `/p/${postId}`,
      category: "comments",
    });
    this.announce(post, "comment.created", String(created._id));
    return (await this.toViews([created.toObject()]))[0]!;
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
      if (!c.removedAt) await this.posts.incCommentCount(c.postId, -1, session);
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
      const res = await this.comments.updateMany(theirs, { $set: { deletedAt: new Date() } }, { session }).exec();
      for (const post of showing) await this.posts.incCommentCount(post._id, -post.n, session);
      return { comments: res.modifiedCount };
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

  private async toViews(rows: (Comment & { _id: unknown })[]): Promise<CommentView[]> {
    const authors = await this.users.authorCards(rows.map((r) => r.authorUid));
    return rows.map((r) => {
      const a = authors.get(r.authorUid);
      return {
        _id: String(r._id),
        postId: r.postId,
        authorUid: r.authorUid,
        author: { uid: r.authorUid, displayName: a?.displayName ?? "Neighbour", photoURL: a?.photoURL },
        content: r.content,
        createdAt: (r.createdAt ?? new Date()).toISOString(),
        likes: [],
      };
    });
  }
}
