import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, type ClientSession, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CommunicationsService } from "../communications/communications.service";
import { accountActionEmail, messageEmail } from "../communications/templates/email-templates";
import { HoodsService } from "../hoods/hoods.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { Viewer } from "../shared/auth/viewer";
import { ROLE_RANK, type AccountStatus, type Role, type VerificationStatus } from "../shared/authz/roles";
import { withTransaction } from "../shared/db/transaction";
import { parseSort, searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { User, UserDocument } from "./schemas/user.schema";

export type NeighbourAction = "verify" | "reject_verification" | "change_hood" | "warn" | "restrict" | "suspend" | "reinstate";

export interface NeighbourActionInput {
  action: NeighbourAction;
  hoodId?: string;
  days?: number;
  reason: string;
  note?: string;
}

export interface NeighbourQuery extends PageQuery {
  hoodId?: string;
  verification?: VerificationStatus;
  account?: AccountStatus;
  role?: Role;
}

export interface NeighbourRow {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: Role;
  hood?: { id: string; name: string };
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  restrictedUntil?: string;
  joinedAt: string;
  lastActiveAt?: string;
}

/** Account actions that a moderator may not take (contract §13.3). */
const ADMIN_ONLY: NeighbourAction[] = ["suspend", "reinstate"];

/**
 * Staff operations on neighbours. Used by /admin/* and by moderation
 * decisions, so account enforcement lives in exactly one place.
 */
@Injectable()
export class StaffUsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly comms: CommunicationsService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(q: NeighbourQuery): Promise<Page<NeighbourRow>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<User> = {
      ...(q.hoodId && { neighborhoodId: q.hoodId }),
      ...(q.verification && { verificationStatus: q.verification }),
      ...(q.account && { accountStatus: q.account }),
      ...(q.role && { role: q.role }),
      ...(re && { $or: [{ displayName: re }, { email: re }] }),
    };
    const sort = parseSort(q.sort, { name: "displayName", joined: "createdAt" }, { createdAt: -1 });
    const [rows, total] = await Promise.all([
      this.users.find(filter).sort(sort).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<User[]>().exec(),
      this.users.countDocuments(filter).exec(),
    ]);
    return { items: await this.toRows(rows), page: q.page, pageSize: q.pageSize, total };
  }

  async get(uid: string): Promise<User> {
    const user = await this.users.findOne({ uid }).lean<User>().exec();
    if (!user) throw new NotFoundException("Neighbour not found.");
    return user;
  }

  async toRows(rows: User[]): Promise<NeighbourRow[]> {
    const hoods = await this.hoods.findManyByIds(rows.map((r) => r.neighborhoodId).filter(Boolean) as string[]);
    return rows.map((u) => {
      const h = u.neighborhoodId ? hoods.get(u.neighborhoodId) : undefined;
      return {
        uid: u.uid,
        displayName: u.displayName ?? "Neighbour",
        email: u.email,
        photoURL: u.photoURL,
        role: u.role,
        hood: h ? { id: u.neighborhoodId!, name: h.name } : undefined,
        verificationStatus: u.verificationStatus,
        accountStatus: u.accountStatus,
        restrictedUntil: u.restrictedUntil?.toISOString(),
        joinedAt: (u.createdAt ?? new Date()).toISOString(),
        lastActiveAt: u.updatedAt?.toISOString(),
      };
    });
  }

  /** One staff action on one neighbour, with its audit entry, atomically. */
  async act(actor: Viewer, uid: string, input: NeighbourActionInput, session?: ClientSession): Promise<User> {
    if ((ADMIN_ONLY.includes(input.action) || (input.days ?? 0) > 7) && !actor.capabilities.includes("moderation.suspend")) {
      throw new ForbiddenException("Only admins can do that.");
    }
    if (uid === actor.uid) throw new BadRequestException("You can't take staff action on your own account.");

    // Set inside the transaction; used afterwards to tell the neighbour.
    let hoodName: string | undefined;
    let joinRequest: string | undefined;
    const run = async (s: ClientSession) => {
      const target = await this.users.findOne({ uid }).session(s).exec();
      if (!target) throw new NotFoundException("Neighbour not found.");
      if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role] && input.action !== "verify" && input.action !== "change_hood") {
        throw new ForbiddenException("You can't take action on staff at or above your role.");
      }
      // A staff decision on verification settles any pending join request (contract §16).
      if ((input.action === "verify" || input.action === "reject_verification") && target.requestedHood) {
        joinRequest = target.requestedHood.name;
        target.requestedHood = null;
      }
      switch (input.action) {
        case "verify":
        case "change_hood": {
          if (!input.hoodId) throw new BadRequestException("Choose a Hood first.");
          const hood = await this.hoods.findById(input.hoodId);
          if (hood.status === "archived") throw new BadRequestException("That Hood is archived.");
          hoodName = hood.name;
          target.neighborhoodId = input.hoodId;
          if (input.action === "verify") {
            target.verificationStatus = "verified";
            target.verifiedAt = new Date();
          }
          break;
        }
        case "reject_verification":
          // Turning down a join request isn't a verdict on the person: they can fix their address or ask again.
          target.verificationStatus = joinRequest ? "unverified" : "rejected";
          break;
        case "restrict":
          target.accountStatus = "restricted";
          target.restrictedUntil = new Date(Date.now() + (input.days ?? 7) * 86_400_000);
          break;
        case "suspend":
          target.accountStatus = "suspended";
          target.restrictedUntil = null;
          break;
        case "reinstate":
          target.accountStatus = "active";
          target.restrictedUntil = null;
          break;
        case "warn":
          break;
      }
      await target.save({ session: s });
      await this.audit.record(actor, input.action, { type: "user", id: uid, label: target.displayName ?? "Neighbour" }, { reason: hoodName ? `${input.reason} → ${hoodName}` : input.reason, note: input.note }, s);
      return target.toObject() as User;
    };
    const updated = session ? await run(session) : await withTransaction(this.connection, run);
    if (!session) await this.tellNeighbour(updated, input, hoodName, joinRequest);
    if (joinRequest) this.realtime.toStaff("queue.changed");
    return updated;
  }

  /** Neighbour-facing notice: public reason only, never the staff note. */
  async tellNeighbour(user: User, input: NeighbourActionInput, hoodName?: string, joinRequest?: string): Promise<void> {
    const hood = hoodName ?? "your new Hood";
    const copy: Partial<Record<NeighbourAction, { title: string; body: string }>> = {
      verify: joinRequest
        ? { title: `You've joined ${hood}`, body: `Our team approved your request. Welcome to ${hood}.` }
        : { title: "You're a verified neighbour", body: `Our team confirmed your address. Welcome to ${hood}.` },
      change_hood: {
        title: `You've moved to ${hood}`,
        body: `Our team moved you to ${hood} (${input.reason}). Your feed now shows ${hood}. Your old posts stay where you posted them.`,
      },
      reject_verification: joinRequest
        ? { title: `Your request to join ${joinRequest} wasn't approved`, body: `Reason: ${input.reason}. You can check your address or ask to join again.` }
        : { title: "We couldn't verify your address", body: `Reason: ${input.reason}. Contact support if you think that's wrong.` },
      warn: { title: "A note from the myHoodora team", body: `Please keep to the community guidelines (${input.reason}).` },
      restrict: { title: "Your account is restricted", body: `You can read and message, but can't post for ${input.days ?? 7} days. Reason: ${input.reason}.` },
      suspend: { title: "Your account is suspended", body: `Reason: ${input.reason}.` },
      reinstate: { title: "Your account is active again", body: "Thanks for your patience." },
    };
    // Hood, verification and account state decide which live channels they
    // hear; make their open tabs reconnect with the new ones.
    if (input.action !== "warn") this.realtime.toUser(user.uid, "session.changed");
    const c = copy[input.action];
    if (!c) return;
    // Hood changes open their neighbourhood settings; account actions open account settings.
    const hoodChange = input.action === "verify" || input.action === "change_hood";
    await this.notifications.notify({ uids: [user.uid], type: "moderation", title: c.title, body: c.body, href: hoodChange || joinRequest ? "/settings/neighbourhood" : "/settings/account" });
    if (!user.email) return;
    const idempotencyKey = `account:${user.uid}:${input.action}:${Date.now()}`;
    if (hoodChange) {
      // Joining or moving Hood changes what they see, so it always warrants an email too.
      await this.comms.sendEmail({
        uid: user.uid,
        to: user.email,
        type: "account_action",
        email: messageEmail({
          subject: c.title,
          name: user.displayName,
          paragraphs: [c.body, "If this doesn't look right, reply to this email or contact us from Help in the app."],
          cta: { href: `${this.config.get<string>("appUrl")}/news-feed`, label: "Open my feed" },
        }),
        idempotencyKey,
      });
    } else if (["restrict", "suspend", "reinstate", "reject_verification"].includes(input.action)) {
      await this.comms.sendEmail({
        uid: user.uid,
        to: user.email,
        type: "account_action",
        email: accountActionEmail({ name: user.displayName, headline: c.title, detail: c.body, helpUrl: "https://myhoodora.com/guidelines" }),
        idempotencyKey,
      });
    }
  }

  /** Neighbours whose address check needs a human (oldest first). */
  async verificationQueue(q: PageQuery & { status?: "pending_review" | "failed" }) {
    const filter: QueryFilter<User> =
      q.status === "pending_review"
        ? { verificationStatus: "pending_review" }
        : q.status === "failed"
          ? { verificationStatus: "unverified", "verificationAttempts.0": { $exists: true } }
          : { $or: [{ verificationStatus: "pending_review" }, { verificationStatus: "unverified", "verificationAttempts.0": { $exists: true } }] };
    const re = searchRegex(q.q);
    if (re) Object.assign(filter, { displayName: re });
    const [rows, total] = await Promise.all([
      this.users.find(filter).sort({ updatedAt: 1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<User[]>().exec(),
      this.users.countDocuments(filter).exec(),
    ]);
    const items = await Promise.all(
      rows.map(async (u) => {
        const last = u.verificationAttempts?.[u.verificationAttempts.length - 1];
        const point = last ? { lat: last.lat, lng: last.lng } : { lat: u.location?.lat ?? 0, lng: u.location?.lng ?? 0 };
        return {
          uid: u.uid,
          displayName: u.displayName ?? "Neighbour",
          submittedAt: (last?.at ?? u.createdAt ?? new Date()).toISOString(),
          address: u.location?.address ?? last?.address ?? "",
          point,
          nearestHoods: await this.hoods.nearest(point.lng, point.lat),
          attempts: u.verificationAttempts?.length ?? 0,
          lastError: last && last.result !== "matched" ? last.result : undefined,
          status: u.verificationStatus === "pending_review" ? ("pending_review" as const) : ("failed" as const),
          requestedHood: u.requestedHood ? { id: u.requestedHood.id, name: u.requestedHood.name } : undefined,
        };
      }),
    );
    return { items, page: q.page, pageSize: q.pageSize, total };
  }

  async team(): Promise<NeighbourRow[]> {
    const rows = await this.users.find({ role: { $ne: "member" } }).sort({ role: -1, displayName: 1 }).lean<User[]>().exec();
    return this.toRows(rows);
  }

  /**
   * Role changes (contract §13.9 + owner). Admins manage moderators; only
   * owners grant/revoke admin or owner; the last owner can't step down.
   */
  async setRole(actor: Viewer, uid: string, role: Role): Promise<User> {
    const touchesAdmins = role === "admin" || role === "owner";
    const updated = await withTransaction(this.connection, async (s) => {
      const target = await this.users.findOne({ uid }).session(s).exec();
      if (!target) throw new NotFoundException("Neighbour not found.");
      const needsOwner = touchesAdmins || target.role === "admin" || target.role === "owner";
      if (needsOwner && !actor.capabilities.includes("team.manage.admins")) throw new ForbiddenException("Only an owner can change admin roles.");
      if (target.role === "owner" && role !== "owner") {
        const owners = await this.users.countDocuments({ role: "owner" }).session(s).exec();
        if (owners <= 1) throw new ConflictException("There must always be at least one owner.");
      }
      const from = target.role;
      target.role = role;
      await target.save({ session: s });
      await this.audit.record(actor, "role_change", { type: "user", id: uid, label: target.displayName ?? "Neighbour" }, { reason: `${from} → ${role}` }, s);
      return target.toObject() as User;
    });
    this.realtime.toUser(uid, "session.changed");
    return updated;
  }
}
