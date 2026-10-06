import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, type ClientSession, type QueryFilter } from "mongoose";
import { HoodsService } from "../hoods/hoods.service";
import { JobsService } from "../jobs/jobs.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { NotificationsService } from "../notifications/notifications.service";
import { URGENT_WINDOW_HOURS, type AlertCategory } from "../platform/platform-settings.schema";
import { PlatformSettingsService } from "../platform/platform-settings.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { Viewer } from "../shared/auth/viewer";
import { searchRegex } from "../shared/http/pagination";
import { mediaMixProblem } from "../storage/media-kind";
import { StorageService } from "../storage/storage.service";
import { AccountLifecycle } from "../users/account-lifecycle";
import { UsersService } from "../users/users.service";
import { eventDateProblem, hasEnded } from "./domain/event-time";
import { decodePostContent, encodePostContent, postTypeFor, type PostMeta } from "./domain/post-meta";
import type { CreatePostDto, FeedQuery } from "./dto/posts.dto";
import { FeedPost, PollVote, Reaction, Rsvp, type PostDocument, type ReactionType } from "./schemas/post.schema";

const URGENT_PER_USER_HOURS = 6;
const HOUR = 3_600_000;
/** Job: tell a Hood about a new alert (PostsService.fanOutAlert). */
const ALERT_FANOUT = "alert.fanout";
/** Neighbours told per step of that job. */
const FANOUT_PAGE = 1_000;

export interface PostView {
  _id: string;
  authorUid: string;
  author: { uid: string; displayName: string; photoURL?: string; neighborhoodName?: string };
  neighborhoodId: string;
  type: FeedPost["type"];
  /** Legacy encoded form, for clients that still decode it. */
  content: string;
  message: string;
  category: FeedPost["category"];
  alertCategory?: string;
  urgent: boolean;
  eventDate?: string;
  eventLocation?: string;
  thankedName?: string;
  priceNaira?: number | null;
  poll?: { options: { id: string; text: string }[]; closesAt: string };
  pollResults?: PollResults;
  /** Events only: the counts and the viewer's own answer, so a list of events needs no request per card. */
  rsvp?: RsvpSummary;
  visibility: FeedPost["visibility"];
  mediaUrls: string[];
  /** width ÷ height of each `mediaUrls` entry (same order), or null when unknown (a pasted link). Lets the feed frame media before it loads. */
  mediaAspects: (number | null)[];
  /** @deprecated use reactionCounts / myReaction. Kept empty for old clients. */
  likes: string[];
  reactionCounts: Partial<Record<ReactionType, number>>;
  reactionTotal: number;
  myReaction: ReactionType | null;
  commentCount: number;
  commentsDisabled: boolean;
  activeUntil?: string;
  resolvedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PollResults {
  postId: string;
  counts: Record<string, number>;
  total: number;
  myVote: string | null;
  closed: boolean;
}

export interface RsvpSummary {
  /** The event is over (start + 3 h): RSVPs are closed. */
  ended: boolean;
  postId: string;
  goingCount: number;
  interestedCount: number;
  myStatus: "going" | "interested" | null;
}

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    @InjectModel(Reaction.name) private readonly reactions: Model<Reaction>,
    @InjectModel(PollVote.name) private readonly votes: Model<PollVote>,
    @InjectModel(Rsvp.name) private readonly rsvps: Model<Rsvp>,
    private readonly users: UsersService,
    private readonly hoods: HoodsService,
    private readonly settings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
    private readonly registry: ModerationRegistry,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.jobs.register(ALERT_FANOUT, (payload) => this.fanOutAlert(String(payload.postId)));
    this.accounts.register({
      name: "posts",
      hide: async (uid) => void (await this.posts.updateMany({ authorUid: uid }, { $set: { authorDeactivated: true } }).exec()),
      unhide: async (uid) => void (await this.posts.updateMany({ authorUid: uid, authorDeactivated: true }, { $unset: { authorDeactivated: 1 } }).exec()),
    });
    this.registry.register({
      type: "post",
      load: async (id) => {
        const p = Types.ObjectId.isValid(id) ? await this.posts.findById(id).lean<FeedPost & { _id: Types.ObjectId }>().exec() : null;
        if (!p) return null;
        const { message, meta } = this.read(p);
        return {
          type: "post",
          id,
          preview: message.slice(0, 200),
          authorUid: p.authorUid,
          hoodId: p.neighborhoodId,
          removed: Boolean(p.removedAt),
          content: { kind: "post", message, category: meta.category, createdAt: p.createdAt?.toISOString(), media: p.mediaUrls, urgent: p.urgent, removed: Boolean(p.removedAt) },
        };
      },
      setRemoved: (id, removed, actorUid, session) => this.setRemoved(id, removed, actorUid, session),
      announce: (id) => this.announce(id),
    });
  }

  /** Typed fields, falling back to the legacy content prefix for un-migrated posts. */
  read(p: FeedPost): { message: string; meta: PostMeta } {
    if (p.message !== undefined && p.message !== null) {
      return {
        message: p.message,
        meta: {
          category: p.category,
          alertCategory: p.alertCategory,
          urgent: p.urgent,
          eventDate: p.eventDate?.toISOString(),
          eventLocation: p.eventLocation,
          thankedName: p.thankedName,
          priceNaira: p.priceNaira,
          visibility: p.visibility,
          poll: p.poll ? { options: p.poll.options, closesAt: p.poll.closesAt.toISOString() } : undefined,
        },
      };
    }
    return decodePostContent(p.content, p.type);
  }

  /**
   * `dto.clientId` makes this safe to repeat: the same id from the same person returns the post
   * created the first time. A client that timed out can't know whether its post was created, and
   * without this its retry posts (and announces) an alert twice.
   */
  async create(viewer: Viewer, dto: CreatePostDto): Promise<PostView> {
    if (!viewer.hoodId) throw new ForbiddenException("Verify your address to join your neighbourhood first.");
    if (dto.neighborhoodId && dto.neighborhoodId !== viewer.hoodId) throw new ForbiddenException("You can only post in your own neighbourhood.");
    // Before any rule that the first attempt already passed (one urgent alert per six hours would refuse its own retry).
    const earlier = dto.clientId ? await this.findByClientId(viewer.uid, dto.clientId) : null;
    if (earlier) return (await this.toViews([earlier], viewer))[0]!;

    // Accept the current web payload (encoded content) and first-class fields.
    const decoded = dto.content ? decodePostContent(dto.content, dto.type ?? "text") : { message: dto.message ?? "", meta: { category: "general" as const } };
    const meta: PostMeta = {
      ...decoded.meta,
      ...(dto.category && { category: dto.category }),
      ...(dto.alertCategory && { alertCategory: dto.alertCategory }),
      ...(dto.urgent !== undefined && { urgent: dto.urgent }),
      ...(dto.eventDate && { eventDate: dto.eventDate }),
      ...(dto.eventLocation && { eventLocation: dto.eventLocation }),
      ...(dto.thankedName && { thankedName: dto.thankedName }),
      ...(dto.priceNaira !== undefined && { priceNaira: dto.priceNaira }),
      ...(dto.poll && { poll: dto.poll }),
      ...(dto.visibility && { visibility: dto.visibility }),
    };
    const message = (dto.message ?? decoded.message).trim();
    if (!message) throw new BadRequestException("Write something first.");
    if (message.length > 8192) throw new BadRequestException("Posts can be up to 8,192 characters.");
    this.validateMeta(meta);

    const now = new Date();
    let activeUntil: Date | undefined;
    if (meta.category === "alert") {
      if (meta.urgent) await this.assertUrgentAllowed(viewer.uid);
      const windows = (await this.settings.get()).alertWindows;
      activeUntil = new Date(now.getTime() + (windows[(meta.alertCategory ?? "other") as AlertCategory] ?? 24) * HOUR);
    }

    const mediaUrls = dto.mediaUrls ?? [];
    const mediaProblem = mediaMixProblem(mediaUrls);
    if (mediaProblem) throw new BadRequestException(mediaProblem);
    let doc: PostDocument;
    try {
      doc = await this.posts.create({
        clientId: dto.clientId,
        authorUid: viewer.uid,
        neighborhoodId: viewer.hoodId,
        type: postTypeFor(meta.category, mediaUrls.length > 0),
        content: encodePostContent(message, meta),
        message,
        category: meta.category,
        alertCategory: meta.category === "alert" ? (meta.alertCategory ?? "other") : undefined,
        urgent: meta.category === "alert" && Boolean(meta.urgent),
        eventDate: meta.eventDate ? new Date(meta.eventDate) : undefined,
        eventLocation: meta.eventLocation,
        thankedName: meta.thankedName,
        priceNaira: meta.category === "for_sale" ? (meta.priceNaira ?? null) : undefined,
        poll: meta.poll ? { options: meta.poll.options, closesAt: new Date(meta.poll.closesAt) } : undefined,
        visibility: meta.visibility ?? "neighbourhood",
        location: dto.location ? { type: "Point", coordinates: [dto.location.lng, dto.location.lat] } : undefined,
        mediaUrls,
        activeUntil,
      });
    } catch (err) {
      // Two copies of one submission arrived together and the other got there first: it created the post, and announces it.
      const winner = dto.clientId && (err as { code?: number }).code === 11000 ? await this.findByClientId(viewer.uid, dto.clientId) : null;
      if (!winner) throw err;
      return (await this.toViews([winner], viewer))[0]!;
    }

    // The Hood is told afterwards, by a job: the post exists now, and the request must answer whether or
    // not thousands of neighbours have been notified yet. For the same reason a job that can't be
    // recorded is logged, not thrown: an error here would make the client retry a post that was created.
    if (meta.category === "alert") {
      await this.jobs
        .enqueue(ALERT_FANOUT, { postId: String(doc._id) }, { dedupeKey: `${ALERT_FANOUT}:${String(doc._id)}` })
        .catch((err: unknown) => this.logger.error(`Alert ${String(doc._id)} was posted but its neighbours could not be queued for notification`, err instanceof Error ? err.stack : String(err)));
    }
    this.realtime.toHood(viewer.hoodId, "post.created", { id: String(doc._id) });
    return (await this.toViews([doc.toObject()], viewer))[0]!;
  }

  private findByClientId(authorUid: string, clientId: string) {
    return this.posts.findOne({ authorUid, clientId }).lean<FeedPost & { _id: Types.ObjectId }>().exec();
  }

  private validateMeta(meta: PostMeta) {
    if (meta.category === "event") {
      if (!meta.eventDate || !meta.eventLocation) throw new BadRequestException("Events need a date and a place.");
      // Not just the composer: an event can't be dated in the past (1 h grace) or more than a year ahead.
      const problem = eventDateProblem(new Date(meta.eventDate));
      if (problem) throw new BadRequestException(problem);
    }
    if (meta.category === "thanks" && !meta.thankedName) throw new BadRequestException("Say who you're thanking.");
    if (meta.category === "poll") {
      const p = meta.poll;
      if (!p || p.options.length < 2 || p.options.length > 4) throw new BadRequestException("Polls need 2 to 4 options.");
      const texts = p.options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length || new Set(p.options.map((o) => o.id)).size !== texts.length) {
        throw new BadRequestException("Poll options must be different.");
      }
      const days = (new Date(p.closesAt).getTime() - Date.now()) / (24 * HOUR);
      if (!(days > 0 && days <= 7.05)) throw new BadRequestException("Polls can run for up to 7 days.");
    }
    if (meta.priceNaira !== undefined && meta.priceNaira !== null && meta.priceNaira < 0) throw new BadRequestException("Price must be ₦0 or more.");
  }

  /** Contract §1: protect the red state — 1 urgent alert per user per 6 h, verified only. */
  private async assertUrgentAllowed(uid: string) {
    const recent = await this.posts.exists({ authorUid: uid, urgent: true, createdAt: { $gt: new Date(Date.now() - URGENT_PER_USER_HOURS * HOUR) } });
    if (recent) {
      throw new HttpException(`You can post one urgent alert every ${URGENT_PER_USER_HOURS} hours. Post it as a normal alert instead.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * The "alert.fanout" job: tell the alert's Hood about it, a page of neighbours at a time.
   *
   * Jobs can run more than once (a retry after a failure part-way, a takeover), so this must be
   * safe to repeat. Ordinary alerts are bundled per kind for 30 minutes (`groupKey`), which updates
   * a neighbour's unread notification in place; urgent ones carry a key per alert and neighbour
   * (`dedupeKey`), so a second write is skipped. Either way nobody is told twice.
   */
  async fanOutAlert(postId: string): Promise<void> {
    const p = await this.findRaw(postId);
    // Deleted or removed before anyone was told: there is nothing to announce.
    if (!p || p.category !== "alert" || !p.isActive || p.removedAt) return;
    const { message } = this.read(p);
    const urgent = Boolean(p.urgent);
    // From the post's own time, so every run of the job lands in the same bundle.
    const bucket = Math.floor((p.createdAt ?? new Date()).getTime() / (30 * 60_000));
    let after = "";
    for (;;) {
      const uids = await this.users.membersOfHoodPage(p.neighborhoodId, after, FANOUT_PAGE);
      if (!uids.length) break;
      await this.notifications.notify({
        uids,
        type: "alert",
        actorUid: p.authorUid,
        title: urgent ? `Urgent: ${p.alertCategory} alert nearby` : `New ${p.alertCategory} alert in your Hood`,
        body: message.slice(0, 140),
        href: `/p/${postId}`,
        category: urgent ? "urgent_alerts" : "alerts",
        groupKey: urgent ? undefined : `alert:${p.neighborhoodId}:${p.alertCategory}:${bucket}`,
        dedupeKey: urgent ? (uid) => `alert:${postId}:${uid}` : undefined,
      });
      after = uids[uids.length - 1]!;
      if (uids.length < FANOUT_PAGE) break;
    }
  }

  /**
   * GET /posts/neighborhood/:id — only the caller's own Hood (404 otherwise,
   * contract: "never from the client"). Cursor `before`, or legacy `skip`.
   */
  async feed(viewer: Viewer, hoodId: string, q: FeedQuery): Promise<PostView[]> {
    const staff = viewer.capabilities.includes("admin.access");
    if (!staff && hoodId !== viewer.hoodId) throw new NotFoundException("This neighbourhood isn't available.");
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const filter: QueryFilter<FeedPost> = {
      neighborhoodId: hoodId,
      isActive: true,
      removedAt: null,
      authorDeactivated: { $ne: true },
      ...(q.category && { category: q.category }),
      ...(hidden.length && { authorUid: { $nin: hidden } }),
    };
    const re = searchRegex(q.q);
    // Older posts only have `content` (meta prefix + text); newer ones keep the plain text in `message`.
    if (re) filter.$or = [{ message: re }, { message: null, content: re }];
    const created: Record<string, Date> = {};
    if (q.before) created.$lt = new Date(q.before);
    if (q.since) created.$gte = new Date(q.since);
    if (Object.keys(created).length) filter.createdAt = created;

    let query = this.posts.find(filter).sort({ createdAt: -1, _id: -1 });
    if (!q.before && q.skip) query = query.skip(q.skip);
    const docs = await query.limit(q.limit).lean<FeedPost[]>().exec();
    return this.toViews(docs, viewer);
  }

  /** Raw post for internal use (moderation context); no visibility rules. */
  async findRaw(id: string): Promise<(FeedPost & { _id: Types.ObjectId }) | null> {
    return Types.ObjectId.isValid(id) ? this.posts.findById(id).lean<FeedPost & { _id: Types.ObjectId }>().exec() : null;
  }

  /** Load a post the viewer may see, or 404 (deleted, removed, other Hood, blocked, or its author has deactivated). */
  async loadVisible(viewer: Viewer, id: string): Promise<FeedPost & { _id: Types.ObjectId }> {
    const p = Types.ObjectId.isValid(id) ? await this.posts.findById(id).lean<FeedPost & { _id: Types.ObjectId }>().exec() : null;
    const staff = viewer.capabilities.includes("admin.access");
    if (!p || (!staff && (!p.isActive || p.removedAt || p.authorDeactivated || p.neighborhoodId !== viewer.hoodId))) {
      throw new NotFoundException("This post isn't available.");
    }
    if (!staff) {
      const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
      if (hidden.includes(p.authorUid)) throw new NotFoundException("This post isn't available.");
    }
    return p;
  }

  async get(viewer: Viewer, id: string): Promise<PostView> {
    const p = await this.loadVisible(viewer, id);
    return (await this.toViews([p], viewer))[0]!;
  }

  /** Author delete (soft). 404 if not found/visible, 403 if not the author. */
  async delete(viewer: Viewer, id: string): Promise<void> {
    const p = await this.loadVisible(viewer, id);
    if (p.authorUid !== viewer.uid) throw new ForbiddenException("You can only delete your own posts.");
    await this.posts.updateOne({ _id: p._id }, { $set: { isActive: false } }).exec();
    this.realtime.toHood(p.neighborhoodId, "post.deleted", { id });
  }

  /** PATCH /posts/:id/alert — author or staff (Hood Leads in a later phase). */
  async resolveAlert(viewer: Viewer, id: string, resolved: boolean): Promise<{ resolvedAt: string | null }> {
    const p = await this.loadVisible(viewer, id);
    if (p.category !== "alert") throw new BadRequestException("Only alerts can be resolved.");
    if (p.authorUid !== viewer.uid && !viewer.capabilities.includes("moderation.act")) throw new ForbiddenException("Only the person who posted it can mark it resolved.");
    const resolvedAt = resolved ? new Date() : null;
    await this.posts.updateOne({ _id: p._id }, { $set: { resolvedAt, resolvedBy: resolved ? viewer.uid : undefined } }).exec();
    this.changed(p);
    return { resolvedAt: resolvedAt?.toISOString() ?? null };
  }

  /**
   * Staff-only alert operations (contract §13.6). Takes the caller's session so the change commits with
   * its audit record; the caller announces it (PostsService.announce) once that has happened.
   */
  async staffAlertAction(id: string, action: "end" | "downgrade", actorUid: string, session?: ClientSession): Promise<void> {
    const set = action === "end" ? { resolvedAt: new Date(), resolvedBy: actorUid } : { urgent: false };
    const res = await this.posts.updateOne({ _id: id, category: "alert" }, { $set: set }, { session }).exec();
    if (!res.matchedCount) throw new NotFoundException("Alert not found.");
  }

  async setRemoved(id: string, removed: boolean, actorUid: string, session?: ClientSession): Promise<void> {
    await this.posts
      .updateOne({ _id: id }, removed ? { $set: { removedAt: new Date(), removedBy: actorUid } } : { $set: { removedAt: null }, $unset: { removedBy: 1 } }, { session })
      .exec();
  }

  /**
   * Live update: something about this post changed (reactions, votes, RSVPs,
   * comment count, alert state). Coalesced, so a burst refetches once.
   */
  changed(post: { _id: unknown; neighborhoodId?: string | null }): void {
    this.realtime.toHoodCoalesced(post.neighborhoodId, "post.updated", { id: String(post._id) });
  }

  /** Live update after a change made without the post in hand (staff actions, moderation). */
  async announce(id: string): Promise<void> {
    const p = await this.findRaw(id);
    if (!p) return;
    if (!p.isActive || p.removedAt) this.realtime.toHood(p.neighborhoodId, "post.deleted", { id });
    else this.changed(p);
  }

  incCommentCount(id: string, by: 1 | -1, session?: ClientSession) {
    return this.posts.updateOne({ _id: id }, { $inc: { commentCount: by } }, { session }).exec();
  }

  /** Embed author cards, Hood names, viewer's reaction, poll results and event RSVPs (no N+1). */
  async toViews(docs: (FeedPost & { _id?: unknown })[], viewer: Viewer): Promise<PostView[]> {
    if (!docs.length) return [];
    const ids = docs.map((d) => String(d._id));
    const [authors, mine, polls, rsvps, aspects] = await Promise.all([
      // A neighbour never receives a deactivated author's post at all; staff do, and need to know whose it is.
      this.users.authorCards(docs.map((d) => d.authorUid), { forStaff: viewer.capabilities.includes("admin.access") }),
      this.reactions.find({ postId: { $in: ids }, uid: viewer.uid }).lean<Reaction[]>().exec(),
      this.pollResultsFor(docs.filter((d) => d.poll), viewer.uid),
      this.rsvpSummariesFor(docs.filter((d) => this.read(d).meta.category === "event"), viewer.uid),
      this.storage.aspectRatios(docs.flatMap((d) => d.mediaUrls ?? [])),
    ]);
    const hoods = await this.hoods.findManyByIds([...new Set([...authors.values()].map((a) => a.neighborhoodId).filter(Boolean) as string[])]);
    const myReaction = new Map(mine.map((r) => [r.postId, r.type]));

    return docs.map((d) => {
      const id = String(d._id);
      const { message, meta } = this.read(d);
      const a = authors.get(d.authorUid);
      const counts = d.reactionCounts ?? {};
      return {
        _id: id,
        authorUid: d.authorUid,
        author: { uid: d.authorUid, displayName: a?.displayName ?? "Neighbour", photoURL: a?.photoURL, neighborhoodName: a?.neighborhoodId ? hoods.get(a.neighborhoodId)?.name : undefined },
        neighborhoodId: d.neighborhoodId,
        type: d.type,
        content: d.content,
        message,
        category: meta.category,
        alertCategory: meta.alertCategory,
        urgent: Boolean(meta.urgent),
        eventDate: meta.eventDate,
        eventLocation: meta.eventLocation,
        thankedName: meta.thankedName,
        priceNaira: meta.priceNaira,
        poll: meta.poll,
        pollResults: polls.get(id),
        rsvp: rsvps.get(id),
        visibility: meta.visibility ?? "neighbourhood",
        mediaUrls: d.mediaUrls ?? [],
        mediaAspects: (d.mediaUrls ?? []).map((url) => aspects.get(url) ?? null),
        likes: [],
        reactionCounts: counts,
        reactionTotal: Object.values(counts).reduce((n, c) => n + (c ?? 0), 0),
        myReaction: myReaction.get(id) ?? null,
        commentCount: d.commentCount ?? 0,
        commentsDisabled: Boolean(d.commentsDisabled),
        activeUntil: d.activeUntil?.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        isActive: d.isActive,
        createdAt: (d.createdAt ?? new Date()).toISOString(),
        updatedAt: (d.updatedAt ?? d.createdAt ?? new Date()).toISOString(),
      };
    });
  }

  async pollResultsFor(docs: (FeedPost & { _id?: unknown })[], uid: string): Promise<Map<string, PollResults>> {
    const out = new Map<string, PollResults>();
    if (!docs.length) return out;
    const ids = docs.map((d) => String(d._id));
    const [tallies, mine] = await Promise.all([
      this.votes.aggregate<{ _id: { postId: string; optionId: string }; n: number }>([
        { $match: { postId: { $in: ids } } },
        { $group: { _id: { postId: "$postId", optionId: "$optionId" }, n: { $sum: 1 } } },
      ]),
      this.votes.find({ postId: { $in: ids }, uid }).lean<PollVote[]>().exec(),
    ]);
    for (const d of docs) {
      const id = String(d._id);
      const counts: Record<string, number> = Object.fromEntries((d.poll?.options ?? []).map((o) => [o.id, 0]));
      for (const t of tallies) if (t._id.postId === id && t._id.optionId in counts) counts[t._id.optionId] = t.n;
      out.set(id, {
        postId: id,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        myVote: mine.find((m) => m.postId === id)?.optionId ?? null,
        closed: d.poll ? Date.now() >= new Date(d.poll.closesAt).getTime() : true,
      });
    }
    return out;
  }

  /** RSVP counts and the viewer's own answer for a set of events: two queries, however many events. */
  async rsvpSummariesFor(docs: (FeedPost & { _id?: unknown })[], uid: string): Promise<Map<string, RsvpSummary>> {
    const out = new Map<string, RsvpSummary>();
    if (!docs.length) return out;
    const ids = docs.map((d) => String(d._id));
    const [tallies, mine] = await Promise.all([
      this.rsvps.aggregate<{ _id: { postId: string; status: "going" | "interested" }; n: number }>([
        { $match: { postId: { $in: ids } } },
        { $group: { _id: { postId: "$postId", status: "$status" }, n: { $sum: 1 } } },
      ]),
      this.rsvps.find({ postId: { $in: ids }, uid }).lean<Rsvp[]>().exec(),
    ]);
    const count = (postId: string, status: "going" | "interested") => tallies.find((t) => t._id.postId === postId && t._id.status === status)?.n ?? 0;
    for (const d of docs) {
      const id = String(d._id);
      const eventDate = this.read(d).meta.eventDate;
      out.set(id, {
        postId: id,
        goingCount: count(id, "going"),
        interestedCount: count(id, "interested"),
        myStatus: mine.find((m) => m.postId === id)?.status ?? null,
        ended: hasEnded(eventDate ? new Date(eventDate) : undefined),
      });
    }
    return out;
  }

  isUrgentLive(p: Pick<FeedPost, "urgent" | "createdAt" | "resolvedAt">): boolean {
    return Boolean(p.urgent && !p.resolvedAt && p.createdAt && Date.now() - p.createdAt.getTime() < URGENT_WINDOW_HOURS * HOUR);
  }
}
