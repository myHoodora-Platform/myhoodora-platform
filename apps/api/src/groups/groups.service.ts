import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { HoodsService } from "../hoods/hoods.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { UsersService } from "../users/users.service";
import type { CreateGroupDto, UpdateGroupDto } from "./groups.dto";
import { Group, GroupDocument, GroupMember, GroupMemberDocument, GroupPost, GroupRequest } from "./group.schemas";

export interface GroupView {
  _id: string;
  name: string;
  description: string;
  privacy: Group["privacy"];
  category: Group["category"];
  boundary: Group["boundary"];
  coverPhoto?: string;
  memberCount: number;
  neighborhoodId: string;
  createdBy: string;
  official: boolean;
  membership: "member" | "requested" | "none";
  isAdmin: boolean;
  createdAt: string;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  privacy: string;
  category: string;
  members: number;
  official: boolean;
  hood?: { id: string; name: string };
  createdAt: string;
  status: "active" | "archived";
  openReports: number;
}

type GroupRow = Group & { _id: Types.ObjectId };
const MAX_GROUPS_PER_DAY = 3;
/** "Nearby" boundary = Hoods whose centres are within this distance of yours. */
const NEARBY_METERS = 5_000;

const newToken = () => randomBytes(18).toString("base64url");
const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Contract §8. Group admins moderate their own group; staff can archive any group. */
@Injectable()
export class GroupsService implements OnModuleInit {
  constructor(
    @InjectModel(Group.name) private readonly groups: Model<GroupDocument>,
    @InjectModel(GroupMember.name) private readonly members: Model<GroupMemberDocument>,
    @InjectModel(GroupRequest.name) private readonly requests: Model<GroupRequest>,
    @InjectModel(GroupPost.name) private readonly posts: Model<GroupPost>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly registry: ModerationRegistry,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    this.registry.register({
      type: "group",
      load: async (id) => {
        const g = await this.raw(id);
        if (!g) return null;
        return {
          type: "group",
          id,
          preview: `${g.name}: ${g.description.slice(0, 120)}`,
          authorUid: g.createdBy,
          hoodId: g.neighborhoodId,
          removed: Boolean(g.archivedAt),
          content: { kind: "group", name: g.name, description: g.description, privacy: g.privacy, memberCount: g.memberCount, removed: Boolean(g.archivedAt) },
        };
      },
      setRemoved: async (id, removed, _actor, session) => {
        await this.groups.updateOne({ _id: id }, { $set: { archivedAt: removed ? new Date() : null } }, { session }).exec();
      },
    });
  }

  private raw(id: string): Promise<GroupRow | null> {
    return Types.ObjectId.isValid(id) ? this.groups.findById(id).lean<GroupRow>().exec() : Promise.resolve(null);
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  /** Which Hoods' groups the viewer can discover, per boundary. */
  private async reach(viewer: Viewer): Promise<{ own: string; nearby: string[]; city: string[] }> {
    if (!viewer.hoodId) throw new NotFoundException("Join a neighbourhood to see groups.");
    const hood = await this.hoods.findById(viewer.hoodId);
    const point = hood.location?.coordinates;
    const [nearby, all] = await Promise.all([point ? this.hoods.findNearby(point[0], point[1], NEARBY_METERS) : Promise.resolve([hood]), this.hoods.findAll()]);
    return { own: viewer.hoodId, nearby: nearby.map((h) => String(h._id)), city: all.filter((h) => h.city === hood.city).map((h) => String(h._id)) };
  }

  private inReach(g: GroupRow, r: { own: string; nearby: string[]; city: string[] }): boolean {
    if (g.neighborhoodId === r.own) return true;
    if (g.boundary === "nearby") return r.nearby.includes(g.neighborhoodId);
    if (g.boundary === "city") return r.city.includes(g.neighborhoodId);
    return false;
  }

  private async membership(groupId: string, uid: string) {
    const [m, req] = await Promise.all([this.members.findOne({ groupId, uid }).lean<GroupMember>().exec(), this.requests.exists({ groupId, uid }).exec()]);
    return { member: m, requested: Boolean(req) };
  }

  /** Group the viewer may see (discoverable, a member, or holding a valid invite). */
  private async loadVisible(viewer: Viewer, id: string, inviteToken?: string): Promise<GroupRow> {
    const g = await this.raw(id);
    if (!g || g.archivedAt) throw new NotFoundException("This group doesn't exist any more.");
    if (inviteToken && sameToken(inviteToken, g.inviteToken)) return g;
    // Membership opens a group only to someone who is (still) a verified neighbour: without a Hood,
    // `reach` below answers 404, so a membership can't outlive a rejected verification.
    if (viewer.hoodId && (await this.members.exists({ groupId: id, uid: viewer.uid }).exec())) return g;
    if (!this.inReach(g, await this.reach(viewer))) throw new NotFoundException("This group doesn't exist any more.");
    return g;
  }

  private async requireAdmin(viewer: Viewer, groupId: string): Promise<GroupRow> {
    const g = await this.loadVisible(viewer, groupId);
    const me = await this.members.findOne({ groupId, uid: viewer.uid }).lean<GroupMember>().exec();
    if (me?.role !== "admin") throw new ForbiddenException("Only group admins can do that.");
    return g;
  }

  /** Private groups: members only (and staff). Open groups: anyone who can see the group. */
  private async requireReadable(viewer: Viewer, g: GroupRow): Promise<void> {
    if (g.privacy === "open" || viewer.capabilities.includes("moderation.act")) return;
    if (!(await this.members.exists({ groupId: String(g._id), uid: viewer.uid }).exec())) {
      throw new ForbiddenException("Join this private group to see its members and posts.");
    }
  }

  // ── Browse ─────────────────────────────────────────────────────────────────

  async list(viewer: Viewer, hoodId?: string): Promise<GroupView[]> {
    if (hoodId && hoodId !== viewer.hoodId) throw new NotFoundException("Groups aren't available for that neighbourhood.");
    const r = await this.reach(viewer);
    const mine = (await this.members.find({ uid: viewer.uid }).select({ groupId: 1 }).lean<Pick<GroupMember, "groupId">[]>().exec()).map((m) => m.groupId);
    const filter: QueryFilter<Group> = {
      archivedAt: null,
      $or: [
        { neighborhoodId: r.own },
        { boundary: "nearby", neighborhoodId: { $in: r.nearby } },
        { boundary: "city", neighborhoodId: { $in: r.city } },
        { _id: { $in: mine.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) } },
      ],
    };
    const rows = await this.groups.find(filter).sort({ official: -1, memberCount: -1, createdAt: -1 }).limit(200).lean<GroupRow[]>().exec();
    return this.toViews(rows, viewer.uid);
  }

  async get(viewer: Viewer, id: string, inviteToken?: string): Promise<GroupView> {
    return (await this.toViews([await this.loadVisible(viewer, id, inviteToken)], viewer.uid))[0]!;
  }

  // ── Create / edit / delete ────────────────────────────────────────────────

  async create(viewer: Viewer, dto: CreateGroupDto): Promise<GroupView> {
    if (!viewer.hoodId || (dto.neighborhoodId && dto.neighborhoodId !== viewer.hoodId)) throw new ForbiddenException("You can only create groups in your own neighbourhood.");
    const since = new Date(Date.now() - 86_400_000);
    if ((await this.groups.countDocuments({ createdBy: viewer.uid, createdAt: { $gt: since } }).exec()) >= MAX_GROUPS_PER_DAY) {
      throw new HttpException(`You can create up to ${MAX_GROUPS_PER_DAY} groups a day. Try again tomorrow.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const hoodId = viewer.hoodId;
    const hood = await this.hoods.findById(hoodId);
    const name = dto.name.trim();
    const nameKey = name.toLowerCase();
    if (await this.groups.exists({ neighborhoodId: hoodId, nameKey }).exec()) {
      throw new ConflictException("A group with this name already exists in your neighbourhood.");
    }
    const group = await withTransaction(this.connection, async (session) => {
      const [g] = await this.groups.create(
        [{ ...dto, name, nameKey, description: dto.description.trim(), neighborhoodId: hoodId, city: hood.city, createdBy: viewer.uid, memberCount: 1, inviteToken: newToken() }],
        { session },
      );
      await this.members.create([{ groupId: String(g!._id), uid: viewer.uid, role: "admin" }], { session });
      return g!;
    });
    return (await this.toViews([group.toObject() as GroupRow], viewer.uid))[0]!;
  }

  async update(viewer: Viewer, id: string, dto: UpdateGroupDto): Promise<GroupView> {
    const g = await this.requireAdmin(viewer, id);
    const set: Partial<Group> = { ...dto };
    if (dto.name) {
      set.name = dto.name.trim();
      set.nameKey = set.name.toLowerCase();
      if (set.nameKey !== g.nameKey && (await this.groups.exists({ neighborhoodId: g.neighborhoodId, nameKey: set.nameKey }).exec())) {
        throw new ConflictException("A group with this name already exists in your neighbourhood.");
      }
    }
    await this.groups.updateOne({ _id: id }, { $set: set }).exec();
    // Opening a private group lets everyone who asked straight in.
    if (g.privacy === "private" && dto.privacy === "open") {
      const waiting = await this.requests.find({ groupId: id }).lean<GroupRequest[]>().exec();
      for (const r of waiting) await this.addMember(id, r.uid, g.name);
    }
    return this.get(viewer, id);
  }

  async delete(viewer: Viewer, id: string): Promise<void> {
    await this.requireAdmin(viewer, id);
    // Nextdoor rule: only while nobody else has posted.
    if (await this.posts.exists({ groupId: id, authorUid: { $ne: viewer.uid } }).exec()) {
      throw new ConflictException("Other neighbours have posted here, so the group can't be deleted. You can leave it or hand it to another admin.");
    }
    await withTransaction(this.connection, async (session) => {
      await this.posts.deleteMany({ groupId: id }, { session }).exec();
      await this.requests.deleteMany({ groupId: id }, { session }).exec();
      await this.members.deleteMany({ groupId: id }, { session }).exec();
      await this.groups.deleteOne({ _id: id }, { session }).exec();
    });
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  private async addMember(groupId: string, uid: string, groupName: string, notify = true): Promise<void> {
    const added = await withTransaction(this.connection, async (session) => {
      await this.requests.deleteOne({ groupId, uid }, { session }).exec();
      const res = await this.members.updateOne({ groupId, uid }, { $setOnInsert: { groupId, uid, role: "member" } }, { upsert: true, session }).exec();
      if (res.upsertedCount) await this.groups.updateOne({ _id: groupId }, { $inc: { memberCount: 1 } }, { session }).exec();
      return res.upsertedCount > 0;
    });
    if (added && notify) {
      await this.notifications.notify({ uids: [uid], type: "group", title: `You're now a member of ${groupName}`, href: `/g/${groupId}`, category: "groups" });
    }
  }

  async join(viewer: Viewer, id: string, inviteToken?: string): Promise<{ membership: GroupView["membership"] }> {
    const g = await this.loadVisible(viewer, id, inviteToken);
    const { member } = await this.membership(id, viewer.uid);
    if (member) return { membership: "member" };
    const invited = Boolean(inviteToken && sameToken(inviteToken, g.inviteToken));
    if (g.privacy === "open" || invited) {
      await this.addMember(id, viewer.uid, g.name, false);
      return { membership: "member" };
    }
    const res = await this.requests.updateOne({ groupId: id, uid: viewer.uid }, { $setOnInsert: { groupId: id, uid: viewer.uid } }, { upsert: true }).exec();
    if (res.upsertedCount) {
      const admins = (await this.members.find({ groupId: id, role: "admin" }).lean<GroupMember[]>().exec()).map((m) => m.uid);
      await this.notifications.notify({
        uids: admins,
        type: "group",
        actorUid: viewer.uid,
        title: `${viewer.displayName ?? "A neighbour"} asked to join ${g.name}`,
        href: `/g/${id}/manage`,
        category: "groups",
        groupKey: `group-requests:${id}`,
      });
    }
    return { membership: "requested" };
  }

  async leave(viewer: Viewer, id: string): Promise<void> {
    const g = await this.raw(id);
    if (!g) throw new NotFoundException("This group doesn't exist any more.");
    await this.requests.deleteOne({ groupId: id, uid: viewer.uid }).exec();
    const me = await this.members.findOne({ groupId: id, uid: viewer.uid }).lean<GroupMember>().exec();
    if (!me) return;
    if (me.role === "admin") {
      const [admins, total] = await Promise.all([this.members.countDocuments({ groupId: id, role: "admin" }).exec(), this.members.countDocuments({ groupId: id }).exec()]);
      if (admins <= 1 && total > 1) throw new ConflictException("You're the only admin. Make another member an admin before you leave.");
    }
    await withTransaction(this.connection, async (session) => {
      const res = await this.members.deleteOne({ groupId: id, uid: viewer.uid }, { session }).exec();
      if (!res.deletedCount) return;
      await this.groups.updateOne({ _id: id }, { $inc: { memberCount: -1 } }, { session }).exec();
      // Nobody left: a group that stayed listed would take new members as plain members, with no admin
      // to run it. Archived rather than deleted, so what former members posted isn't destroyed; like a
      // group staff removed, it is hidden from everyone and keeps its name.
      const remaining = await this.members.countDocuments({ groupId: id }).session(session).exec();
      if (remaining === 0) await this.groups.updateOne({ _id: id }, { $set: { archivedAt: new Date() } }, { session }).exec();
    });
  }

  // ── Invites ────────────────────────────────────────────────────────────────

  async inviteLink(viewer: Viewer, id: string, reset = false): Promise<{ url: string }> {
    const g = await this.loadVisible(viewer, id);
    const me = await this.members.findOne({ groupId: id, uid: viewer.uid }).lean<GroupMember>().exec();
    if (!me) throw new ForbiddenException("Join the group to invite neighbours.");
    if ((g.privacy === "private" || reset) && me.role !== "admin") throw new ForbiddenException("Only group admins can invite to a private group.");
    let token = g.inviteToken;
    if (reset) {
      token = newToken();
      await this.groups.updateOne({ _id: id }, { $set: { inviteToken: token } }).exec();
    }
    return { url: `${this.config.get<string>("appUrl")}/g/${id}?invite=${token}` };
  }

  async invite(viewer: Viewer, id: string, uids: string[]): Promise<void> {
    const g = await this.loadVisible(viewer, id);
    const me = await this.members.findOne({ groupId: id, uid: viewer.uid }).lean<GroupMember>().exec();
    if (!me) throw new ForbiddenException("Join the group to invite neighbours.");
    if (g.privacy === "private" && me.role !== "admin") throw new ForbiddenException("Only group admins can invite to a private group.");
    const already = new Set((await this.members.find({ groupId: id, uid: { $in: uids } }).lean<GroupMember[]>().exec()).map((m) => m.uid));
    const targets = [...new Set(uids)].filter((u) => u !== viewer.uid && !already.has(u));
    await this.notifications.notify({
      uids: targets,
      type: "group",
      actorUid: viewer.uid,
      title: `${viewer.displayName ?? "A neighbour"} invited you to join ${g.name}`,
      body: g.description.slice(0, 140),
      href: `/g/${id}?invite=${g.inviteToken}`,
      category: "groups",
    });
  }

  // ── Admin tools (group admins) ─────────────────────────────────────────────

  async listMembers(viewer: Viewer, id: string) {
    const g = await this.loadVisible(viewer, id);
    await this.requireReadable(viewer, g);
    const rows = await this.members.find({ groupId: id }).lean<GroupMember[]>().exec();
    return rows
      .map((m) => ({ uid: m.uid, role: m.role, joinedAt: (m.joinedAt ?? new Date()).toISOString() }))
      .sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin") || a.joinedAt.localeCompare(b.joinedAt));
  }

  async listRequests(viewer: Viewer, id: string) {
    await this.requireAdmin(viewer, id);
    const rows = await this.requests.find({ groupId: id }).sort({ requestedAt: 1 }).lean<GroupRequest[]>().exec();
    return rows.map((r) => ({ uid: r.uid, requestedAt: (r.requestedAt ?? new Date()).toISOString() }));
  }

  async approve(viewer: Viewer, id: string, uid: string): Promise<void> {
    const g = await this.requireAdmin(viewer, id);
    if (!(await this.requests.exists({ groupId: id, uid }).exec())) throw new NotFoundException("That request isn't waiting any more.");
    await this.addMember(id, uid, g.name);
  }

  /** Not told why (Nextdoor). */
  async decline(viewer: Viewer, id: string, uid: string): Promise<void> {
    await this.requireAdmin(viewer, id);
    await this.requests.deleteOne({ groupId: id, uid }).exec();
  }

  async removeMember(viewer: Viewer, id: string, uid: string, reason?: string): Promise<void> {
    const g = await this.requireAdmin(viewer, id);
    if (uid === viewer.uid) throw new BadRequestException("Use “Leave group” to remove yourself.");
    const target = await this.members.findOne({ groupId: id, uid }).lean<GroupMember>().exec();
    if (!target) throw new NotFoundException("They're not a member.");
    await withTransaction(this.connection, async (session) => {
      await this.members.deleteOne({ groupId: id, uid }, { session }).exec();
      await this.groups.updateOne({ _id: id }, { $inc: { memberCount: -1 } }, { session }).exec();
    });
    await this.notifications.notify({
      uids: [uid],
      type: "group",
      title: `You were removed from ${g.name}`,
      body: reason ? `Reason: ${reason}` : undefined,
      href: "/groups",
      category: "groups",
    });
  }

  async setRole(viewer: Viewer, id: string, uid: string, role: "admin" | "member"): Promise<void> {
    await this.requireAdmin(viewer, id);
    const target = await this.members.findOne({ groupId: id, uid }).exec();
    if (!target) throw new NotFoundException("They're not a member.");
    if (target.role === "admin" && role === "member" && (await this.members.countDocuments({ groupId: id, role: "admin" }).exec()) <= 1) {
      throw new ConflictException("A group needs at least one admin.");
    }
    target.role = role;
    await target.save();
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  async listPosts(viewer: Viewer, id: string) {
    const g = await this.loadVisible(viewer, id);
    await this.requireReadable(viewer, g);
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const rows = await this.posts
      .find({ groupId: id, ...(hidden.length && { authorUid: { $nin: hidden } }) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<(GroupPost & { _id: Types.ObjectId })[]>()
      .exec();
    return this.postViews(rows);
  }

  async createPost(viewer: Viewer, id: string, content: string) {
    await this.loadVisible(viewer, id);
    if (!(await this.members.exists({ groupId: id, uid: viewer.uid }).exec())) throw new ForbiddenException("Join the group to post.");
    const text = content.trim();
    if (!text) throw new BadRequestException("Write something first.");
    const doc = await this.posts.create({ groupId: id, authorUid: viewer.uid, content: text });
    await this.announcePost(id);
    return (await this.postViews([doc.toObject() as GroupPost & { _id: Types.ObjectId }]))[0]!;
  }

  async deletePost(viewer: Viewer, id: string, postId: string): Promise<void> {
    const p = Types.ObjectId.isValid(postId) ? await this.posts.findOne({ _id: postId, groupId: id }).lean<GroupPost>().exec() : null;
    if (!p) throw new NotFoundException("Post not found.");
    if (p.authorUid !== viewer.uid) await this.requireAdmin(viewer, id);
    await this.posts.deleteOne({ _id: postId }).exec();
    await this.announcePost(id);
  }

  /** Live update for members only: groups can span Hoods and be private, so never the Hood channel. */
  private async announcePost(groupId: string): Promise<void> {
    const uids = (await this.members.find({ groupId }).select({ uid: 1 }).lean<Pick<GroupMember, "uid">[]>().exec()).map((m) => m.uid);
    this.realtime.toUsers(uids, "group.post", { groupId });
  }

  private async postViews(rows: (GroupPost & { _id: Types.ObjectId })[]) {
    const cards = await this.users.authorCards(rows.map((r) => r.authorUid));
    return rows.map((p) => {
      const c = cards.get(p.authorUid);
      return {
        _id: String(p._id),
        groupId: p.groupId,
        authorUid: p.authorUid,
        author: { uid: p.authorUid, displayName: c?.displayName ?? "Neighbour", photoURL: c?.photoURL },
        content: p.content,
        createdAt: (p.createdAt ?? new Date()).toISOString(),
      };
    });
  }

  private async toViews(rows: GroupRow[], uid: string): Promise<GroupView[]> {
    const ids = rows.map((r) => String(r._id));
    const [mine, reqs] = await Promise.all([
      this.members.find({ groupId: { $in: ids }, uid }).lean<GroupMember[]>().exec(),
      this.requests.find({ groupId: { $in: ids }, uid }).lean<GroupRequest[]>().exec(),
    ]);
    const role = new Map(mine.map((m) => [m.groupId, m.role]));
    const asked = new Set(reqs.map((r) => r.groupId));
    return rows.map((g) => {
      const id = String(g._id);
      return {
        _id: id,
        name: g.name,
        description: g.description,
        privacy: g.privacy,
        category: g.category,
        boundary: g.boundary,
        coverPhoto: g.coverPhoto,
        memberCount: g.memberCount,
        neighborhoodId: g.neighborhoodId,
        createdBy: g.createdBy,
        official: g.official,
        membership: role.has(id) ? "member" : asked.has(id) ? "requested" : "none",
        isAdmin: role.get(id) === "admin",
        createdAt: (g.createdAt ?? new Date()).toISOString(),
      };
    });
  }

  // ── Staff (§13.6) ──────────────────────────────────────────────────────────

  async adminList(
    q: PageQuery & { status?: AdminGroupRow["status"]; reported?: boolean; hoodId?: string; privacy?: string },
    openReports: (ids: string[]) => Promise<Map<string, number>>,
  ): Promise<Page<AdminGroupRow>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<Group> = {
      ...(q.hoodId && { neighborhoodId: q.hoodId }),
      ...(q.privacy && { privacy: q.privacy as Group["privacy"] }),
      ...(q.status === "archived" ? { archivedAt: { $ne: null } } : q.status === "active" ? { archivedAt: null } : {}),
      ...(re && { $or: [{ name: re }, { description: re }] }),
    };
    let rows = await this.groups.find(filter).sort({ memberCount: -1 }).limit(q.reported ? 1000 : q.page * q.pageSize).lean<GroupRow[]>().exec();
    const counts = await openReports(rows.map((r) => String(r._id)));
    if (q.reported) rows = rows.filter((r) => (counts.get(String(r._id)) ?? 0) > 0);
    const total = q.reported ? rows.length : await this.groups.countDocuments(filter).exec();
    const pageRows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    const hoods = await this.hoods.findManyByIds(pageRows.map((r) => r.neighborhoodId));
    return {
      items: pageRows.map((g) => ({
        id: String(g._id),
        name: g.name,
        privacy: g.privacy,
        category: g.category,
        members: g.memberCount,
        official: g.official,
        hood: hoods.get(g.neighborhoodId) ? { id: g.neighborhoodId, name: hoods.get(g.neighborhoodId)!.name } : undefined,
        createdAt: (g.createdAt ?? new Date()).toISOString(),
        status: g.archivedAt ? "archived" : "active",
        openReports: counts.get(String(g._id)) ?? 0,
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }
}
