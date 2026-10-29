import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService, isOpenHood } from "../hoods/hoods.service";
import { InboundService } from "../inbound/inbound.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import type { Page } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";
import { StaffUsersService } from "../users/staff-users.service";
import type { ApproveHoodRequestDto, CreateHoodRequestDto, HoodRequestQuery } from "./hood-requests.dto";
import { HoodRequest, HoodRequestDocument, type HoodRequestKind, type HoodRequestStatus } from "./hood-request.schema";

/** Home plus this many: enough for work and family, small enough to stay local (decision 2026-10-22). */
export const MAX_SECONDARY_HOODS = 2;

type HoodRef = { id: string; name: string; city?: string };

/** What the neighbour sees of a request: never staff names or notes beyond the reason they're given. */
export interface HoodRequestView {
  id: string;
  kind: HoodRequestKind;
  status: HoodRequestStatus;
  hood: HoodRef | null;
  reason: string;
  /** Why it was declined or removed. */
  decisionNote?: string;
  /** The support conversation about it, in Messages (contract §18). */
  threadId?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface MyHoods {
  home: HoodRef | null;
  secondary: (HoodRef & { since: string })[];
  /** Pending ones, then the last few decided. */
  requests: HoodRequestView[];
  maxSecondary: number;
}

export interface AdminHoodRequest extends HoodRequestView {
  neighbour: { uid: string; displayName: string; photoURL?: string };
  home: HoodRef | null;
  secondaryCount: number;
  /** Move only, and only for staff who may see addresses (contract §13.3). */
  address?: string;
  point?: { lat: number; lng: number };
  decidedBy?: string;
}

type Row = HoodRequest & { _id: Types.ObjectId };

/**
 * Neighbourhood requests (contract §31): a verified neighbour asks for a secondary Hood (to read it
 * and hear its alerts) or to move home; staff approve, decline, ask for more in a support
 * conversation, and can later remove a secondary Hood. Neighbours never change Hoods themselves.
 */
@Injectable()
export class HoodRequestsService {
  constructor(
    @InjectModel(HoodRequest.name) private readonly requests: Model<HoodRequestDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly staffUsers: StaffUsersService,
    private readonly inbound: InboundService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  // ── The neighbour ─────────────────────────────────────────────────────────

  async mine(viewer: Viewer): Promise<MyHoods> {
    const user = await this.verifiedUser(viewer);
    const rows = await this.requests.find({ uid: viewer.uid }).sort({ createdAt: -1 }).limit(20).lean<Row[]>().exec();
    const pending = rows.filter((r) => r.status === "pending");
    const decided = rows.filter((r) => r.status !== "pending").slice(0, 5);
    const hoods = await this.hoodRefs([user.neighborhoodId!, ...rows.map((r) => r.hoodId).filter(Boolean) as string[]]);
    return {
      home: hoods.get(user.neighborhoodId!) ?? null,
      secondary: (user.secondaryHoods ?? []).map((h) => ({ id: h.id, name: h.name, city: h.city, since: new Date(h.since).toISOString() })),
      requests: [...pending, ...decided].map((r) => this.view(r, hoods)),
      maxSecondary: MAX_SECONDARY_HOODS,
    };
  }

  async create(viewer: Viewer, dto: CreateHoodRequestDto): Promise<HoodRequestView> {
    const user = await this.verifiedUser(viewer);
    const reason = dto.reason.trim();
    let hood: HoodRef | null = null;

    if (dto.kind === "secondary") {
      const target = (await this.hoods.findManyByIds([dto.hoodId!])).get(dto.hoodId!);
      if (!target || !isOpenHood(target)) throw new BadRequestException("That neighbourhood isn't available right now.");
      if (dto.hoodId === user.neighborhoodId) throw new BadRequestException("That's already your home neighbourhood.");
      if (user.secondaryHoods?.some((h) => h.id === dto.hoodId)) throw new ConflictException(`You already follow ${target.name}.`);
      const pending = await this.requests.find({ uid: viewer.uid, kind: "secondary", status: "pending" }).lean<Row[]>().exec();
      if (pending.some((r) => r.hoodId === dto.hoodId)) throw new ConflictException(`You've already asked to add ${target.name}.`);
      if ((user.secondaryHoods?.length ?? 0) + pending.length >= MAX_SECONDARY_HOODS) {
        throw new ConflictException(`You can follow up to ${MAX_SECONDARY_HOODS} neighbourhoods besides your home. Remove one, or withdraw a request, to ask for another.`);
      }
      hood = { id: dto.hoodId!, name: target.name, city: target.city };
    } else {
      if (await this.requests.exists({ uid: viewer.uid, kind: "move", status: "pending" })) {
        throw new ConflictException("You've already asked to move. Withdraw that request to send a new one.");
      }
      // Which Hood the new address is in, if any: staff see it, and can still choose another.
      const match = await this.hoods.findVerifiedMatch(dto.lng!, dto.lat!);
      if (match?.neighborhoodId === user.neighborhoodId) throw new BadRequestException("That address is in your current neighbourhood, so there's nothing to move.");
      if (match) hood = (await this.hoodRefs([match.neighborhoodId])).get(match.neighborhoodId) ?? null;
    }

    const row = await withTransaction(this.connection, async (s) => {
      const [doc] = await this.requests.create(
        [
          {
            uid: viewer.uid,
            kind: dto.kind,
            hoodId: hood?.id,
            fromHoodId: user.neighborhoodId,
            reason,
            ...(dto.kind === "move" && { address: dto.address!.trim(), point: { lat: dto.lat!, lng: dto.lng! } }),
          },
        ],
        { session: s },
      );
      await this.audit.record(viewer, `hood_request_${dto.kind}`, { type: "user", id: viewer.uid, label: hood?.name ?? "New address" }, { reason }, s);
      return doc!.toObject() as Row;
    });
    this.realtime.toStaff("queue.changed");
    return this.view(row, new Map(hood ? [[hood.id, hood]] : []));
  }

  async withdraw(viewer: Viewer, id: string): Promise<void> {
    const res = await this.requests.updateOne({ _id: this.objectId(id), uid: viewer.uid, status: "pending" }, { $set: { status: "withdrawn", decidedAt: new Date() } }).exec();
    if (!res.modifiedCount) throw new NotFoundException("There's no pending request like that.");
    this.realtime.toStaff("queue.changed");
  }

  /** The neighbour stops following a secondary Hood themselves. */
  async leave(viewer: Viewer, hoodId: string): Promise<void> {
    const before = await this.users.findOneAndUpdate({ uid: viewer.uid, "secondaryHoods.id": hoodId }, { $pull: { secondaryHoods: { id: hoodId } } }).lean<User>().exec();
    if (!before) throw new NotFoundException("You don't follow that neighbourhood.");
    await this.requests.updateMany({ uid: viewer.uid, kind: "secondary", hoodId, status: "approved" }, { $set: { status: "removed", decisionNote: "You stopped following it." } }).exec();
    this.realtime.toUser(viewer.uid, "session.changed");
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  async list(actor: Viewer, q: HoodRequestQuery): Promise<Page<AdminHoodRequest>> {
    const filter: QueryFilter<HoodRequest> = { status: q.status ?? "pending", ...(q.kind && { kind: q.kind }) };
    const [rows, total] = await Promise.all([
      this.requests
        .find(filter)
        // The oldest waiting first; decided ones newest first.
        .sort(filter.status === "pending" ? { createdAt: 1 } : { decidedAt: -1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean<Row[]>()
        .exec(),
      this.requests.countDocuments(filter).exec(),
    ]);
    const people = new Map((await this.users.find({ uid: { $in: rows.map((r) => r.uid) } }).lean<User[]>().exec()).map((u) => [u.uid, u]));
    const hoods = await this.hoodRefs(rows.flatMap((r) => [r.hoodId, r.fromHoodId, people.get(r.uid)?.neighborhoodId]).filter(Boolean) as string[]);
    const seeAddress = actor.capabilities.includes("neighbours.address");
    const items = rows.map((r): AdminHoodRequest => {
      const u = people.get(r.uid);
      return {
        ...this.view(r, hoods),
        neighbour: { uid: r.uid, displayName: u?.displayName ?? "Neighbour", photoURL: u?.photoURL },
        home: u?.neighborhoodId ? (hoods.get(u.neighborhoodId) ?? null) : null,
        secondaryCount: u?.secondaryHoods?.length ?? 0,
        ...(seeAddress && r.address && { address: r.address, point: r.point }),
        decidedBy: r.decidedBy?.displayName,
      };
    });
    return { items, page: q.page, pageSize: q.pageSize, total };
  }

  async approve(actor: Viewer, id: string, dto: ApproveHoodRequestDto): Promise<void> {
    const r = await this.pending(id);
    const user = await this.users.findOne({ uid: r.uid }).lean<User>().exec();
    if (!user || user.verificationStatus !== "verified" || !user.neighborhoodId) throw new ConflictException("This neighbour isn't verified any more, so the request can't be approved.");
    const decided = { status: "approved" as const, decidedAt: new Date(), decidedBy: { uid: actor.uid, displayName: actor.displayName } };

    if (r.kind === "secondary") {
      const hood = await this.hoods.findById(r.hoodId!);
      if (!isOpenHood(hood)) throw new ConflictException(`${hood.name} isn't open right now.`);
      await withTransaction(this.connection, async (s) => {
        const added = await this.users
          .updateOne(
            // Re-checked inside the write: never more than the limit, never twice, never home.
            { uid: r.uid, neighborhoodId: { $ne: r.hoodId }, "secondaryHoods.id": { $ne: r.hoodId }, [`secondaryHoods.${MAX_SECONDARY_HOODS - 1}`]: { $exists: false } },
            { $push: { secondaryHoods: { id: r.hoodId!, name: hood.name, city: hood.city, since: new Date() } } },
            { session: s },
          )
          .exec();
        if (!added.modifiedCount) throw new ConflictException(`This neighbour already follows ${hood.name}, or already has ${MAX_SECONDARY_HOODS} extra neighbourhoods.`);
        await this.requests.updateOne({ _id: r._id }, { $set: decided }, { session: s }).exec();
        await this.audit.record(actor, "secondary_hood_add", { type: "user", id: r.uid, label: hood.name }, { reason: r.reason, note: dto.note }, s);
      });
      this.realtime.toUser(r.uid, "session.changed");
      await this.tell(r.uid, `You can now follow ${hood.name}`, "You'll see its posts and hear its safety alerts. You still post and sell in your home neighbourhood.");
    } else {
      const hoodId = dto.hoodId ?? r.hoodId;
      if (!hoodId) throw new BadRequestException("This address isn't in a neighbourhood. Choose one to move them to.");
      await withTransaction(this.connection, async (s) => {
        // The staff move (audited, settles their access) plus the new address on their record.
        await this.staffUsers.act(actor, r.uid, { action: "change_hood", hoodId, reason: "Approved move request", note: dto.note }, s);
        await this.users
          .updateOne(
            { uid: r.uid },
            { $set: { location: { address: r.address, lat: r.point?.lat, lng: r.point?.lng }, verifiedAt: new Date() }, $pull: { secondaryHoods: { id: hoodId } } },
            { session: s },
          )
          .exec();
        await this.requests.updateOne({ _id: r._id }, { $set: { ...decided, hoodId } }, { session: s }).exec();
      });
      const moved = (await this.users.findOne({ uid: r.uid }).lean<User>().exec())!;
      const hood = (await this.hoodRefs([hoodId])).get(hoodId);
      await this.staffUsers.tellNeighbour(moved, { action: "change_hood", hoodId, reason: "you asked to move" }, hood?.name);
    }
    this.realtime.toStaff("queue.changed");
  }

  async decline(actor: Viewer, id: string, reason: string, note?: string): Promise<void> {
    const r = await this.pending(id);
    await withTransaction(this.connection, async (s) => {
      await this.requests.updateOne({ _id: r._id }, { $set: { status: "declined", decidedAt: new Date(), decidedBy: { uid: actor.uid, displayName: actor.displayName }, decisionNote: reason.trim() } }, { session: s }).exec();
      await this.audit.record(actor, "hood_request_decline", { type: "user", id: r.uid, label: r.kind === "move" ? "Move" : "Secondary neighbourhood" }, { reason, note }, s);
    });
    const hood = r.hoodId ? (await this.hoodRefs([r.hoodId])).get(r.hoodId) : undefined;
    await this.tell(r.uid, r.kind === "move" ? "Your request to move wasn't approved" : `Your request to follow ${hood?.name ?? "a neighbourhood"} wasn't approved`, `Reason: ${reason.trim()}`);
    this.realtime.toStaff("queue.changed");
  }

  /**
   * Ask the neighbour for more: one support conversation per request (contract §18), started the
   * first time and replied to after. It appears pinned in their Messages.
   */
  async chat(actor: Viewer, id: string, body: string): Promise<{ threadId: string }> {
    const r = await this.find(id);
    if (r.threadId) {
      await this.inbound.reply(actor, r.threadId, body.trim());
      return { threadId: r.threadId };
    }
    const subject = r.kind === "move" ? "About your request to move" : "About your neighbourhood request";
    const thread = await this.inbound.startConversation(actor, { uid: r.uid, subject, body: body.trim() });
    await this.requests.updateOne({ _id: r._id }, { $set: { threadId: thread.id } }).exec();
    return { threadId: thread.id };
  }

  /** Staff take a secondary Hood away (it was approved, but no longer fits). */
  async removeSecondary(actor: Viewer, uid: string, hoodId: string, reason: string, note?: string): Promise<void> {
    const name = await withTransaction(this.connection, async (s) => {
      const before = await this.users.findOneAndUpdate({ uid, "secondaryHoods.id": hoodId }, { $pull: { secondaryHoods: { id: hoodId } } }, { session: s }).lean<User>().exec();
      if (!before) throw new NotFoundException("This neighbour doesn't follow that neighbourhood.");
      const hoodName = before.secondaryHoods.find((h) => h.id === hoodId)?.name ?? "a neighbourhood";
      await this.requests.updateMany({ uid, kind: "secondary", hoodId, status: "approved" }, { $set: { status: "removed", decisionNote: reason.trim() } }, { session: s }).exec();
      await this.audit.record(actor, "secondary_hood_remove", { type: "user", id: uid, label: hoodName }, { reason, note }, s);
      return hoodName;
    });
    this.realtime.toUser(uid, "session.changed");
    await this.tell(uid, `You no longer follow ${name}`, `Our team removed it from your neighbourhoods. Reason: ${reason.trim()}`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async verifiedUser(viewer: Viewer): Promise<User> {
    if (!viewer.hoodId) throw new ForbiddenException("Join your neighbourhood first: requests are for verified neighbours.");
    const user = await this.users.findOne({ uid: viewer.uid }).lean<User>().exec();
    if (!user) throw new NotFoundException("Profile not found.");
    return user;
  }

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Request not found.");
    return new Types.ObjectId(id);
  }

  private async find(id: string): Promise<Row> {
    const r = await this.requests.findById(this.objectId(id)).lean<Row>().exec();
    if (!r) throw new NotFoundException("Request not found.");
    return r;
  }

  private async pending(id: string): Promise<Row> {
    const r = await this.find(id);
    if (r.status !== "pending") throw new ConflictException("This request has already been dealt with.");
    return r;
  }

  private async hoodRefs(ids: string[]): Promise<Map<string, HoodRef>> {
    const found = await this.hoods.findManyByIds([...new Set(ids)]);
    return new Map([...found].map(([id, h]) => [id, { id, name: h.name, city: h.city }]));
  }

  private view(r: Row, hoods: Map<string, HoodRef>): HoodRequestView {
    return {
      id: String(r._id),
      kind: r.kind,
      status: r.status,
      hood: r.hoodId ? (hoods.get(r.hoodId) ?? null) : null,
      reason: r.reason,
      decisionNote: r.decisionNote,
      threadId: r.threadId,
      createdAt: (r.createdAt ?? new Date()).toISOString(),
      decidedAt: r.decidedAt?.toISOString(),
    };
  }

  private async tell(uid: string, title: string, body: string): Promise<void> {
    await this.notifications.notify({ uids: [uid], type: "verification", title, body, href: "/settings/neighbourhoods" });
  }
}
