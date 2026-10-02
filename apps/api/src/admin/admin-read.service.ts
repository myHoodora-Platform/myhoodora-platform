import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CommentsService } from "../comments/comments.service";
import { Neighborhood, NeighborhoodDocument, type HoodStatus } from "../hoods/schemas/hood.schema";
import { BusinessesService } from "../businesses/businesses.service";
import { InboundService } from "../inbound/inbound.module";
import { AppealsService } from "../moderation/appeals.service";
import { TelemetryService } from "../telemetry/telemetry.module";
import { ModerationService } from "../moderation/moderation.service";
import { URGENT_WINDOW_HOURS, type AlertCategory } from "../platform/platform-settings.schema";
import { PlatformSettingsService } from "../platform/platform-settings.service";
import { PostsService } from "../posts/posts.service";
import { FeedPost, type PostDocument } from "../posts/schemas/post.schema";
import { parseSort, searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface AdminHood {
  id: string;
  name: string;
  city: string;
  country: string;
  description?: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  status: HoodStatus;
  stats: { members: number; verifiedPct: number; posts7d: number; openReports: number; growth7d: number };
  createdAt: string;
}

export interface AdminPost {
  id: string;
  message: string;
  category: string;
  urgent?: boolean;
  author: { uid: string; displayName: string };
  hood?: { id: string; name: string };
  createdAt: string;
  status: "visible" | "removed";
  reactions: number;
  comments: number;
  openReports: number;
}

export type AlertLevel = "urgent" | "active" | "resolved" | "ended";

/**
 * Read models for the admin (overview, Hood health, content lists, insights).
 * Queries only — every change goes through the owning domain service.
 */
@Injectable()
export class AdminReadService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    @InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>,
    private readonly postsService: PostsService,
    private readonly comments: CommentsService,
    private readonly moderation: ModerationService,
    private readonly settings: PlatformSettingsService,
    private readonly audit: AuditService,
    private readonly inbound: InboundService,
    private readonly businesses: BusinessesService,
    private readonly appeals: AppealsService,
    private readonly telemetry: TelemetryService,
  ) {}

  // ── Hoods ───────────────────────────────────────────────────────────────

  private async hoodStats(ids: string[]) {
    const since = new Date(Date.now() - 7 * DAY);
    const [members, posts, reports] = await Promise.all([
      this.users.aggregate<{ _id: string; members: number; verified: number; new7d: number }>([
        { $match: { neighborhoodId: { $in: ids }, deactivatedAt: null } },
        {
          $group: {
            _id: "$neighborhoodId",
            members: { $sum: 1 },
            verified: { $sum: { $cond: [{ $eq: ["$verificationStatus", "verified"] }, 1, 0] } },
            new7d: { $sum: { $cond: [{ $gte: ["$verifiedAt", since] }, 1, 0] } },
          },
        },
      ]),
      this.posts.aggregate<{ _id: string; n: number }>([{ $match: { neighborhoodId: { $in: ids }, createdAt: { $gte: since }, isActive: true } }, { $group: { _id: "$neighborhoodId", n: { $sum: 1 } } }]),
      this.moderation.list({ status: "active", page: 1, pageSize: 100 } as PageQuery & { status: "active" }),
    ]);
    const m = new Map(members.map((r) => [r._id, r]));
    const p = new Map(posts.map((r) => [r._id, r.n]));
    const open = new Map<string, number>();
    for (const r of reports.items) if (r.target.hoodId) open.set(r.target.hoodId, (open.get(r.target.hoodId) ?? 0) + 1);
    return (id: string) => {
      const row = m.get(id);
      return {
        members: row?.members ?? 0,
        verifiedPct: row?.members ? Math.round((row.verified / row.members) * 100) : 0,
        posts7d: p.get(id) ?? 0,
        openReports: open.get(id) ?? 0,
        growth7d: row?.new7d ?? 0,
      };
    };
  }

  private toAdminHood(h: Neighborhood & { _id: Types.ObjectId }, stats: AdminHood["stats"]): AdminHood {
    const [lng, lat] = h.location?.coordinates ?? [0, 0];
    return {
      id: String(h._id),
      name: h.name,
      city: h.city,
      country: h.country,
      description: h.description,
      center: { lat, lng },
      radiusMeters: h.radiusMeters,
      status: h.status ?? (h.isActive === false ? "paused" : "active"),
      stats,
      createdAt: (h.createdAt ?? new Date()).toISOString(),
    };
  }

  async listHoods(q: PageQuery & { city?: string; status?: HoodStatus }): Promise<Page<AdminHood>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<Neighborhood> = {
      ...(q.city && { city: q.city }),
      ...(q.status ? { status: q.status } : { status: { $ne: "archived" } }),
      ...(re && { $or: [{ name: re }, { city: re }] }),
    };
    // Hoods number in the tens: compute stats for all matches, sort, then page.
    const docs = await this.hoods.find(filter).lean<(Neighborhood & { _id: Types.ObjectId })[]>().exec();
    const stats = await this.hoodStats(docs.map((d) => String(d._id)));
    const rows = docs.map((d) => this.toAdminHood(d, stats(String(d._id))));
    const [field, dir] = (q.sort ?? "members:desc").split(":");
    const key: Record<string, (h: AdminHood) => number | string> = {
      name: (h) => h.name,
      members: (h) => h.stats.members,
      growth: (h) => h.stats.growth7d,
      reports: (h) => h.stats.openReports,
    };
    const pick = key[field ?? "members"] ?? key.members!;
    rows.sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return dir === "asc" ? c : -c;
    });
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), page: q.page, pageSize: q.pageSize, total: rows.length };
  }

  async hoodDetail(id: string) {
    const h = Types.ObjectId.isValid(id) ? await this.hoods.findById(id).lean<Neighborhood & { _id: Types.ObjectId }>().exec() : null;
    if (!h) throw new NotFoundException("Hood not found.");
    const stats = (await this.hoodStats([id]))(id);
    // Daily member counts for 14 days, from verification dates.
    const joins = await this.users
      .find({ neighborhoodId: id, verifiedAt: { $ne: null } })
      .select({ verifiedAt: 1 })
      .lean<Pick<User, "verifiedAt">[]>()
      .exec();
    const members7d = Array.from({ length: 14 }, (_, i) => {
      const end = new Date(Date.now() - (13 - i) * DAY);
      return { day: end.toISOString().slice(0, 10), members: joins.filter((j) => j.verifiedAt! <= end).length };
    });
    return { ...this.toAdminHood(h, stats), members7d, timeline: await this.audit.forTarget("hood", id) };
  }

  // ── Posts & alerts ───────────────────────────────────────────────────────

  private async toAdminPosts(docs: (FeedPost & { _id: Types.ObjectId })[]): Promise<AdminPost[]> {
    const ids = docs.map((d) => String(d._id));
    const [authors, hoods, open] = await Promise.all([
      this.users.find({ uid: { $in: docs.map((d) => d.authorUid) } }).select({ uid: 1, displayName: 1 }).lean<Pick<User, "uid" | "displayName">[]>().exec(),
      this.hoods.find({ _id: { $in: [...new Set(docs.map((d) => d.neighborhoodId))].filter((x) => Types.ObjectId.isValid(x)) } }).select({ name: 1 }).lean<{ _id: Types.ObjectId; name: string }[]>().exec(),
      this.moderation.openCountsByTarget("post", ids),
    ]);
    const a = new Map(authors.map((u) => [u.uid, u.displayName ?? "Neighbour"]));
    const hmap = new Map(hoods.map((h) => [String(h._id), h.name]));
    return docs.map((d) => {
      const { message, meta } = this.postsService.read(d);
      return {
        id: String(d._id),
        message,
        category: meta.category,
        urgent: d.urgent,
        author: { uid: d.authorUid, displayName: a.get(d.authorUid) ?? "Neighbour" },
        hood: hmap.has(d.neighborhoodId) ? { id: d.neighborhoodId, name: hmap.get(d.neighborhoodId)! } : undefined,
        createdAt: (d.createdAt ?? new Date()).toISOString(),
        status: d.removedAt ? "removed" : "visible",
        reactions: Object.values(d.reactionCounts ?? {}).reduce<number>((n, c) => n + (c ?? 0), 0),
        comments: d.commentCount ?? 0,
        openReports: open.get(String(d._id)) ?? 0,
      };
    });
  }

  async listPosts(q: PageQuery & { hoodId?: string; category?: string; authorUid?: string; status?: "visible" | "removed"; reported?: boolean; from?: string; to?: string }): Promise<Page<AdminPost>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<FeedPost> = {
      isActive: true,
      ...(q.hoodId && { neighborhoodId: q.hoodId }),
      ...(q.category && { category: q.category as FeedPost["category"] }),
      ...(q.authorUid && { authorUid: q.authorUid }),
      ...(q.status === "removed" ? { removedAt: { $ne: null } } : q.status === "visible" ? { removedAt: null } : {}),
      ...(re && { $or: [{ message: re }, { content: re }] }),
    };
    if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lt: new Date(q.to) }) };
    if (q.reported) {
      const reported = await this.moderation.list({ status: "active", type: "post", page: 1, pageSize: 100 } as never);
      filter._id = { $in: reported.items.map((r) => r.target.id).filter((x) => Types.ObjectId.isValid(x)) };
    }
    const sort = parseSort(q.sort, { created: "createdAt", comments: "commentCount" }, { createdAt: -1 });
    const [docs, total] = await Promise.all([
      this.posts.find(filter).sort(sort).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<(FeedPost & { _id: Types.ObjectId })[]>().exec(),
      this.posts.countDocuments(filter).exec(),
    ]);
    return { items: await this.toAdminPosts(docs), page: q.page, pageSize: q.pageSize, total };
  }

  async postDetail(id: string) {
    const d = await this.postsService.findRaw(id);
    if (!d) throw new NotFoundException("Post not found.");
    const [view] = await this.toAdminPosts([d]);
    const comments = await this.comments.allForPost(id);
    const names = new Map(
      (await this.users.find({ uid: { $in: comments.map((c) => c.authorUid) } }).select({ uid: 1, displayName: 1 }).lean<Pick<User, "uid" | "displayName">[]>().exec()).map((u) => [u.uid, u.displayName ?? "Neighbour"]),
    );
    const commentIds = comments.map((c) => String(c._id));
    const [postCases, commentCases, postTimeline, commentTimelines] = await Promise.all([
      this.moderation.list({ status: "all", type: "post", page: 1, pageSize: 50 } as never).then((p) => p.items.filter((r) => r.target.id === id)),
      commentIds.length ? this.moderation.list({ status: "all", type: "comment", page: 1, pageSize: 100 } as never).then((p) => p.items.filter((r) => commentIds.includes(r.target.id))) : [],
      this.audit.forTarget("post", id),
      Promise.all(commentIds.map((c) => this.audit.forTarget("comment", c))),
    ]);
    return {
      ...view!,
      media: d.mediaUrls ?? [],
      alertCategory: d.alertCategory,
      commentsList: comments.map((c) => ({
        id: String(c._id),
        message: c.content,
        author: { uid: c.authorUid, displayName: names.get(c.authorUid) ?? "Neighbour" },
        createdAt: (c.createdAt ?? new Date()).toISOString(),
        status: c.removedAt ? "removed" : "visible",
      })),
      reports: [...postCases, ...commentCases],
      timeline: [...postTimeline, ...commentTimelines.flat()].sort((a, b) => b.at.localeCompare(a.at)),
    };
  }

  alertLevel(d: FeedPost, windows: Record<AlertCategory, number>, now = Date.now()): AlertLevel {
    if (d.resolvedAt) return "resolved";
    const age = now - (d.createdAt?.getTime() ?? now);
    if (d.urgent && age < URGENT_WINDOW_HOURS * HOUR) return "urgent";
    const until = d.activeUntil?.getTime() ?? (d.createdAt?.getTime() ?? now) + (windows[(d.alertCategory ?? "other") as AlertCategory] ?? 24) * HOUR;
    return now < until ? "active" : "ended";
  }

  async listAlerts(q: PageQuery & { level?: AlertLevel | "live"; hoodId?: string }) {
    const windows = (await this.settings.get()).alertWindows;
    const docs = await this.posts
      .find({ category: "alert", isActive: true, removedAt: null, createdAt: { $gte: new Date(Date.now() - 7 * DAY) }, ...(q.hoodId && { neighborhoodId: q.hoodId }) })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean<(FeedPost & { _id: Types.ObjectId })[]>()
      .exec();
    const leveled = docs
      .map((d) => ({ d, level: this.alertLevel(d, windows) }))
      .filter(({ level }) => (q.level === "live" ? level === "urgent" || level === "active" : !q.level || level === q.level));
    const re = searchRegex(q.q);
    const matched = re ? leveled.filter(({ d }) => re.test(d.message ?? d.content)) : leveled;
    const pageRows = matched.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    const views = await this.toAdminPosts(pageRows.map((r) => r.d));
    return {
      items: views.map((v, i) => ({ ...v, alertCategory: pageRows[i]!.d.alertCategory ?? "other", level: pageRows[i]!.level })),
      page: q.page,
      pageSize: q.pageSize,
      total: matched.length,
    };
  }

  async liveUrgentCount(): Promise<number> {
    return this.posts.countDocuments({ category: "alert", urgent: true, resolvedAt: null, removedAt: null, isActive: true, createdAt: { $gte: new Date(Date.now() - URGENT_WINDOW_HOURS * HOUR) } }).exec();
  }

  // ── Neighbour counts ─────────────────────────────────────────────────────

  async neighbourCounts(uid: string) {
    const [posts, against, filed] = await Promise.all([
      this.posts.countDocuments({ authorUid: uid, isActive: true }).exec(),
      this.moderation.list({ status: "all", authorUid: uid, page: 1, pageSize: 1 } as never).then((p) => p.total),
      this.moderation.reportsFiledBy(uid),
    ]);
    return { posts, reportsAgainst: against, reportsFiled: filed };
  }

  // ── Overview & insights ──────────────────────────────────────────────────

  async overview() {
    const now = Date.now();
    const w1 = new Date(now - 7 * DAY);
    const w2 = new Date(now - 14 * DAY);
    const [businessApplications, openAppeals] = await Promise.all([this.businesses.pendingCount(), this.appeals.openCount()]);
    const [open, pending, urgent, inbox, newNow, newPrev, postsNow, postsPrev, activeHoods, hoodsTotal, mNow, mPrev, recent] = await Promise.all([
      this.moderation.openCount(),
      this.users.countDocuments({ $or: [{ verificationStatus: "pending_review" }, { verificationStatus: "unverified", "verificationAttempts.0": { $exists: true } }] }).exec(),
      this.liveUrgentCount(),
      this.inbound.openCount(),
      this.users.countDocuments({ createdAt: { $gte: w1 } }).exec(),
      this.users.countDocuments({ createdAt: { $gte: w2, $lt: w1 } }).exec(),
      this.posts.countDocuments({ createdAt: { $gte: w1 } }).exec(),
      this.posts.countDocuments({ createdAt: { $gte: w2, $lt: w1 } }).exec(),
      this.posts.distinct("neighborhoodId", { createdAt: { $gte: w1 } }).then((x) => x.length),
      this.posts.distinct("neighborhoodId", { createdAt: { $gte: w2, $lt: w1 } }).then((x) => x.length),
      this.moderation.medianResolveHours(w1, new Date(now)),
      this.moderation.medianResolveHours(w2, w1),
      this.audit.recent(10),
    ]);
    return {
      attention: {
        openReports: open.open,
        urgentReports: open.high,
        oldestOpenReportAt: open.oldest?.toISOString() ?? null,
        pendingVerifications: pending,
        businessApplications,
        unansweredInbox: inbox,
        openAppeals,
        liveUrgentAlerts: urgent,
      },
      pulse: {
        newNeighbours: { value: newNow, previous: newPrev },
        posts: { value: postsNow, previous: postsPrev },
        activeHoods: { value: activeHoods, previous: hoodsTotal },
        medianResolveHours: { value: mNow, previous: mPrev },
      },
      recentActions: recent,
    };
  }

  async insights() {
    const since = new Date(Date.now() - 30 * DAY);
    const [signups, funnel, active, reasons, median, kindness] = await Promise.all([
      this.users.aggregate<{ _id: string; n: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
      ]),
      Promise.all([
        this.users.countDocuments({}).exec(),
        this.users.countDocuments({ verificationStatus: "verified" }).exec(),
        this.users.countDocuments({ $or: [{ verificationStatus: "rejected" }, { "verificationAttempts.result": { $ne: "matched" }, "verificationAttempts.0": { $exists: true } }] }).exec(),
      ]),
      this.listHoods({ page: 1, pageSize: 8, sort: "members:desc" } as PageQuery),
      this.moderation.reasonTotals(),
      this.moderation.medianResolveHours(since, new Date()),
      this.telemetry.total("kindness.shown", 30),
    ]);
    const byDay = new Map(signups.map((s) => [s._id, s.n]));
    return {
      signups: Array.from({ length: 30 }, (_, i) => {
        const day = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10);
        return { day, count: byDay.get(day) ?? 0 };
      }),
      verifiedFunnel: { started: funnel[0], verified: funnel[1], failed: funnel[2] },
      activeByHood: active.items.map((h) => ({ hood: h.name, members: h.stats.members, posts7d: h.stats.posts7d })).sort((a, b) => b.posts7d - a.posts7d),
      reportsByReason: reasons,
      medianResolveHours: median || null,
      kindnessPrompts: kindness,
    };
  }
}
