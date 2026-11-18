import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Connection, Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CommentsService } from "../comments/comments.service";
import { hoodTeamViewer, HOOD_TEAM_UID } from "../hood-content/domain/hood-team";
import { HoodsService } from "../hoods/hoods.service";
import type { Viewer } from "../shared/auth/viewer";
import { User, type UserDocument } from "../users/schemas/user.schema";

/** Which Hoods a staff member looks after (plan WP-B). One document per staff member. */
@Schema({ timestamps: true, collection: "hood_assignments" })
export class HoodAssignment {
  @Prop({ required: true, unique: true }) staffUid!: string;
  @Prop({ type: [String], default: [] }) hoodIds!: string[];
  @Prop() updatedBy?: string;
}
export const HoodAssignmentSchema = SchemaFactory.createForClass(HoodAssignment);
HoodAssignmentSchema.index({ hoodIds: 1 });

/** Reply to a newcomer's first post within this long (07:00–22:00 WAT): plan §6. */
export const REPLY_WITHIN_MIN = 120;
const LOOK_BACK_MS = 3 * 86_400_000;
/** "Newcomer": joined within this many days. */
const NEWCOMER_DAYS = 14;

export interface NeedsReplyItem {
  postId: string;
  hood: { id: string; name: string };
  author: { uid: string; displayName: string; newcomer: boolean };
  /** Their first post ever: answered first. */
  firstPost: boolean;
  category: string;
  excerpt: string;
  createdAt: string;
  waitingMinutes: number;
  overdue: boolean;
}

export interface ConsoleStats {
  /** Posts from the last 7 days (neighbours', not the Hood Team's). */
  posts: number;
  replied: number;
  medianMinutesToFirstReply: number | null;
  /** First replies by staff and the Hood Team, per person. */
  firstRepliesByStaff: { uid: string; displayName: string; count: number }[];
}

type PostRow = { _id: Types.ObjectId; authorUid: string; neighborhoodId: string; category: string; message?: string; content: string; createdAt: Date };

/**
 * The moderator console (plan WP-B): posts nobody has answered yet, newcomers' first posts first; reply
 * as yourself (labelled Staff) or as the Hood Team; who looks after which Hoods; how fast replies come.
 */
@Injectable()
export class ModConsoleService {
  constructor(
    @InjectModel(HoodAssignment.name) private readonly assignments: Model<HoodAssignment>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly comments: CommentsService,
    private readonly hoods: HoodsService,
    private readonly audit: AuditService,
  ) {}

  private get posts() {
    return this.connection.collection<PostRow & { isActive: boolean; removedAt: Date | null; commentCount: number; source?: string; visibility?: string }>("posts");
  }

  async myHoods(uid: string): Promise<string[]> {
    return (await this.assignments.findOne({ staffUid: uid }).lean<HoodAssignment>().exec())?.hoodIds ?? [];
  }

  async needsReply(viewer: Viewer, q: { mine?: boolean; hoodId?: string }, now = new Date()): Promise<{ items: NeedsReplyItem[]; waiting: number; overdue: number; myHoods: number }> {
    const mine = q.mine ? await this.myHoods(viewer.uid) : null;
    const staffUids = (await this.users.find({ $or: [{ role: { $ne: "member" } }, { accountKind: "team" }] }).select({ uid: 1 }).lean<Pick<User, "uid">[]>().exec()).map((u) => u.uid);
    const rows = await this.posts
      .find({
        isActive: true,
        removedAt: null,
        commentCount: 0,
        createdAt: { $gte: new Date(now.getTime() - LOOK_BACK_MS) },
        authorUid: { $nin: [HOOD_TEAM_UID, ...staffUids] },
        ...(q.hoodId ? { neighborhoodId: q.hoodId } : mine ? { neighborhoodId: { $in: mine } } : {}),
      })
      .project<PostRow>({ authorUid: 1, neighborhoodId: 1, category: 1, message: 1, content: 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .limit(300)
      .toArray();
    const authorUids = [...new Set(rows.map((r) => r.authorUid))];
    const [authors, firsts, hoods] = await Promise.all([
      this.users.find({ uid: { $in: authorUids } }).select({ uid: 1, displayName: 1, createdAt: 1 }).lean<User[]>().exec(),
      this.posts.aggregate<{ _id: string; first: Types.ObjectId }>([{ $match: { authorUid: { $in: authorUids } } }, { $sort: { createdAt: 1 } }, { $group: { _id: "$authorUid", first: { $first: "$_id" } } }]).toArray(),
      this.hoods.findManyByIds([...new Set(rows.map((r) => r.neighborhoodId))]),
    ]);
    const byUid = new Map(authors.map((a) => [a.uid, a]));
    const firstOf = new Map(firsts.map((f) => [f._id, String(f.first)]));
    const items = rows.map((r): NeedsReplyItem => {
      const a = byUid.get(r.authorUid);
      const waitingMinutes = Math.max(0, Math.round((now.getTime() - r.createdAt.getTime()) / 60_000));
      return {
        postId: String(r._id),
        hood: { id: r.neighborhoodId, name: hoods.get(r.neighborhoodId)?.name ?? "Unknown" },
        author: { uid: r.authorUid, displayName: a?.displayName ?? "Neighbour", newcomer: Boolean(a?.createdAt && now.getTime() - a.createdAt.getTime() < NEWCOMER_DAYS * 86_400_000) },
        firstPost: firstOf.get(r.authorUid) === String(r._id),
        category: r.category,
        excerpt: (r.message ?? r.content ?? "").slice(0, 180),
        createdAt: r.createdAt.toISOString(),
        waitingMinutes,
        overdue: waitingMinutes > REPLY_WITHIN_MIN,
      };
    });
    // Newcomers' first posts first (a quick reply is what makes them stay), then whoever has waited longest.
    items.sort((a, b) => Number(b.firstPost && b.author.newcomer) - Number(a.firstPost && a.author.newcomer) || b.waitingMinutes - a.waitingMinutes);
    return { items: items.slice(0, 100), waiting: items.length, overdue: items.filter((i) => i.overdue).length, myHoods: mine?.length ?? (await this.myHoods(viewer.uid)).length };
  }

  /** Reply as yourself (shown with a Staff label) or as the Hood Team. Audited. */
  async reply(viewer: Viewer, input: { postId: string; content: string; as: "self" | "team" }) {
    const post = Types.ObjectId.isValid(input.postId) ? await this.posts.findOne({ _id: new Types.ObjectId(input.postId) }, { projection: { neighborhoodId: 1, isActive: 1 } }) : null;
    if (!post || !post.isActive) throw new NotFoundException("That post isn't there any more.");
    if (!input.content.trim()) throw new BadRequestException("Write a reply first.");
    const as = input.as === "team" ? hoodTeamViewer(post.neighborhoodId) : viewer;
    const comment = await this.comments.create(as, input.postId, input.content);
    await this.audit.record(viewer, input.as === "team" ? "console_reply_team" : "console_reply", { type: "post", id: input.postId, label: input.content.slice(0, 60) });
    return comment;
  }

  async listAssignments(): Promise<{ staff: { uid: string; displayName: string; role: string; hoods: { id: string; name: string }[] }[] }> {
    const [staff, rows] = await Promise.all([
      this.users.find({ role: { $in: ["moderator", "admin", "owner"] }, purgedAt: null }).select({ uid: 1, displayName: 1, role: 1 }).sort({ displayName: 1 }).lean<User[]>().exec(),
      this.assignments.find().lean<HoodAssignment[]>().exec(),
    ]);
    const byStaff = new Map(rows.map((r) => [r.staffUid, r.hoodIds]));
    const hoods = await this.hoods.findManyByIds([...new Set(rows.flatMap((r) => r.hoodIds))]);
    return {
      staff: staff.map((s) => ({ uid: s.uid, displayName: s.displayName ?? "Staff", role: s.role, hoods: (byStaff.get(s.uid) ?? []).map((id) => ({ id, name: hoods.get(id)?.name ?? "Unknown" })) })),
    };
  }

  async setAssignment(actor: Viewer, staffUid: string, hoodIds: string[]): Promise<void> {
    const staff = await this.users.findOne({ uid: staffUid, role: { $in: ["moderator", "admin", "owner"] } }).select({ displayName: 1 }).lean<User>().exec();
    if (!staff) throw new NotFoundException("That person isn't on the team.");
    const found = await this.hoods.findManyByIds(hoodIds);
    if (found.size !== new Set(hoodIds).size) throw new BadRequestException("One of those neighbourhoods doesn't exist.");
    await this.assignments.updateOne({ staffUid }, { $set: { hoodIds: [...new Set(hoodIds)], updatedBy: actor.uid } }, { upsert: true }).exec();
    await this.audit.record(actor, "hood_assignment", { type: "user", id: staffUid, label: staff.displayName ?? "Staff" }, { note: `${hoodIds.length} Hoods` });
  }

  /** Last 7 days: how many posts got a reply, how fast, and who answered first. */
  async stats(now = new Date()): Promise<ConsoleStats> {
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const rows = await this.posts
      .aggregate<{ _id: Types.ObjectId; createdAt: Date; first?: { authorUid: string; createdAt: Date } }>([
        { $match: { createdAt: { $gte: since }, authorUid: { $ne: HOOD_TEAM_UID }, removedAt: null } },
        { $project: { createdAt: 1, authorUid: 1, idStr: { $toString: "$_id" } } },
        {
          $lookup: {
            from: "comments",
            let: { pid: "$idStr", author: "$authorUid" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$postId", "$$pid"] }, { $ne: ["$authorUid", "$$author"] }] } } }, { $sort: { createdAt: 1 } }, { $limit: 1 }, { $project: { authorUid: 1, createdAt: 1 } }],
            as: "firstReply",
          },
        },
        { $project: { createdAt: 1, first: { $first: "$firstReply" } } },
      ])
      .toArray();
    const replied = rows.filter((r) => r.first);
    const minutes = replied.map((r) => (r.first!.createdAt.getTime() - r.createdAt.getTime()) / 60_000).sort((a, b) => a - b);
    const median = minutes.length ? Math.round(minutes[Math.floor((minutes.length - 1) / 2)]!) : null;
    const counts = new Map<string, number>();
    for (const r of replied) counts.set(r.first!.authorUid, (counts.get(r.first!.authorUid) ?? 0) + 1);
    const staff = await this.users.find({ uid: { $in: [...counts.keys()] }, $or: [{ role: { $ne: "member" } }, { accountKind: "team" }] }).select({ uid: 1, displayName: 1 }).lean<User[]>().exec();
    return {
      posts: rows.length,
      replied: replied.length,
      medianMinutesToFirstReply: median,
      firstRepliesByStaff: staff.map((s) => ({ uid: s.uid, displayName: s.displayName ?? "Staff", count: counts.get(s.uid) ?? 0 })).sort((a, b) => b.count - a.count),
    };
  }
}
