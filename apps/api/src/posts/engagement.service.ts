import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { FeedPost, PollVote, Reaction, Rsvp, type PostDocument, type ReactionType } from "./schemas/post.schema";
import { PostsService, type PollResults, type PostView } from "./posts.service";

export interface RsvpSummary {
  postId: string;
  goingCount: number;
  interestedCount: number;
  myStatus: "going" | "interested" | null;
}

/** Reactions, poll votes and RSVPs — the viewer's interactions with a post. */
@Injectable()
export class EngagementService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    @InjectModel(Reaction.name) private readonly reactions: Model<Reaction>,
    @InjectModel(PollVote.name) private readonly votes: Model<PollVote>,
    @InjectModel(Rsvp.name) private readonly rsvps: Model<Rsvp>,
    private readonly postsService: PostsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Reactions (one per person per post; counts kept in the same transaction) ──

  async react(viewer: Viewer, postId: string, type: ReactionType): Promise<PostView> {
    const post = await this.postsService.loadVisible(viewer, postId);
    const previous = await withTransaction(this.connection, async (session) => {
      const before = await this.reactions.findOneAndUpdate({ postId, uid: viewer.uid }, { $set: { type } }, { upsert: true, session, new: false }).lean<Reaction>().exec();
      if (before?.type === type) return before.type;
      const inc: Record<string, number> = { [`reactionCounts.${type}`]: 1 };
      if (before) inc[`reactionCounts.${before.type}`] = -1;
      await this.posts.updateOne({ _id: postId }, { $inc: inc }, { session }).exec();
      return before?.type ?? null;
    });
    if (previous !== type) this.postsService.changed(post);
    if (!previous && post.authorUid !== viewer.uid) {
      await this.notifications.notify({
        uids: [post.authorUid],
        type: "reaction",
        actorUid: viewer.uid,
        title: `${viewer.displayName ?? "A neighbour"} reacted to your post`,
        href: `/p/${postId}`,
        category: "comments",
        groupKey: `reaction:${postId}`,
      });
    }
    return this.postsService.get(viewer, postId);
  }

  async unreact(viewer: Viewer, postId: string): Promise<PostView> {
    const post = await this.postsService.loadVisible(viewer, postId);
    const removed = await withTransaction(this.connection, async (session) => {
      const r = await this.reactions.findOneAndDelete({ postId, uid: viewer.uid }, { session }).lean<Reaction>().exec();
      if (r) await this.posts.updateOne({ _id: postId }, { $inc: { [`reactionCounts.${r.type}`]: -1 } }, { session }).exec();
      return Boolean(r);
    });
    if (removed) this.postsService.changed(post);
    return this.postsService.get(viewer, postId);
  }

  /** Legacy PATCH /posts/:id/like: toggles a "like" (or removes any reaction). */
  async toggleLike(viewer: Viewer, postId: string): Promise<PostView> {
    const existing = await this.reactions.exists({ postId, uid: viewer.uid });
    return existing ? this.unreact(viewer, postId) : this.react(viewer, postId, "like");
  }

  // ── Polls (anonymous; change or remove while open) ──

  private async openPoll(viewer: Viewer, postId: string) {
    const post = await this.postsService.loadVisible(viewer, postId);
    if (!post.poll) throw new BadRequestException("This post isn't a poll.");
    return post;
  }

  async pollResults(viewer: Viewer, postId: string): Promise<PollResults> {
    const post = await this.openPoll(viewer, postId);
    return (await this.postsService.pollResultsFor([post], viewer.uid)).get(postId)!;
  }

  async vote(viewer: Viewer, postId: string, optionId: string): Promise<PollResults> {
    const post = await this.openPoll(viewer, postId);
    if (Date.now() >= new Date(post.poll!.closesAt).getTime()) throw new HttpException("This poll has closed.", HttpStatus.GONE);
    if (!post.poll!.options.some((o) => o.id === optionId)) throw new BadRequestException("That option isn't in this poll.");
    await this.votes.updateOne({ postId, uid: viewer.uid }, { $set: { optionId } }, { upsert: true }).exec();
    this.postsService.changed(post);
    return this.pollResults(viewer, postId);
  }

  async unvote(viewer: Viewer, postId: string): Promise<PollResults> {
    const post = await this.openPoll(viewer, postId);
    if (Date.now() >= new Date(post.poll!.closesAt).getTime()) throw new HttpException("This poll has closed.", HttpStatus.GONE);
    await this.votes.deleteOne({ postId, uid: viewer.uid }).exec();
    this.postsService.changed(post);
    return this.pollResults(viewer, postId);
  }

  // ── RSVP (events only) ──

  private async eventPost(viewer: Viewer, postId: string) {
    const post = await this.postsService.loadVisible(viewer, postId);
    if (post.category !== "event") throw new BadRequestException("Only events take RSVPs.");
    return post;
  }

  async rsvpSummary(viewer: Viewer, postId: string): Promise<RsvpSummary> {
    await this.eventPost(viewer, postId);
    return this.summary(viewer.uid, postId);
  }

  async rsvp(viewer: Viewer, postId: string, status: "going" | "interested"): Promise<RsvpSummary> {
    const post = await this.eventPost(viewer, postId);
    if (!viewer.capabilities.includes("content.react")) throw new ForbiddenException("Verify your address to join events.");
    const before = await this.rsvps.findOneAndUpdate({ postId, uid: viewer.uid }, { $set: { status } }, { upsert: true, new: false }).lean<Rsvp>().exec();
    if (before?.status !== status) this.postsService.changed(post);
    if (status === "going" && before?.status !== "going") {
      await this.notifications.notify({
        uids: [post.authorUid],
        type: "event",
        actorUid: viewer.uid,
        title: `${viewer.displayName ?? "A neighbour"} is going to your event`,
        href: `/p/${postId}`,
        category: "events",
        groupKey: `rsvp:${postId}`,
      });
    }
    return this.summary(viewer.uid, postId);
  }

  async cancelRsvp(viewer: Viewer, postId: string): Promise<RsvpSummary> {
    const post = await this.eventPost(viewer, postId);
    const res = await this.rsvps.deleteOne({ postId, uid: viewer.uid }).exec();
    if (res.deletedCount) this.postsService.changed(post);
    return this.summary(viewer.uid, postId);
  }

  private async summary(uid: string, postId: string): Promise<RsvpSummary> {
    const [going, interested, mine] = await Promise.all([
      this.rsvps.countDocuments({ postId, status: "going" }).exec(),
      this.rsvps.countDocuments({ postId, status: "interested" }).exec(),
      this.rsvps.findOne({ postId, uid }).lean<Rsvp>().exec(),
    ]);
    return { postId, goingCount: going, interestedCount: interested, myStatus: mine?.status ?? null };
  }
}
