import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, type PipelineStage } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import type { Viewer } from "../shared/auth/viewer";
import { User, type UserDocument } from "../users/schemas/user.schema";
import { canStillClaim, firstName, makeInviteCode, normaliseCode, shortName, type InviteVia } from "./domain/invite-code";
import { inviteFlags, type InviteFlagReason } from "./domain/invite-flags";

/** A device id the app or browser made up for itself (random, stored on the device). */
export const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** GET /admin/invites/flags: inviters whose invites look like one person (staff decide). */
export interface InviteFlagGroup {
  inviter: { uid: string; displayName: string; code?: string };
  reasons: InviteFlagReason[];
  invitees: { uid: string; displayName: string; joinedAt: string; verified: boolean; reasons: InviteFlagReason[] }[];
}

/** On a neighbour's staff page (contract §40). */
export interface StaffInviteView {
  code: string | null;
  invitedBy: { uid: string; displayName: string; code: string; via: string; at: string; vouched: boolean; changedByStaff: boolean; reviewed: boolean } | null;
  /** Why their invite looks off, if it does. */
  flags: InviteFlagReason[];
  joined: number;
  verified: number;
}

/** GET /invites/me. */
export interface InviteSummary {
  code: string;
  /** The personal invite link (path 1 in the plan): share it anywhere. */
  link: string;
  /** People who joined with their code, and how many of them have verified (only those count). */
  joined: number;
  verified: number;
  /** Of the verified ones, how many live in their own Hood. */
  verifiedInMyHood: number;
  /** The newest 20, short names only. */
  people: { name: string; hoodName?: string; verified: boolean; joinedAt: string }[];
  /** Who invited them, if anyone (first name only). */
  invitedBy: { name: string } | null;
  /** Show the one-time "Who invited you?" card. */
  askWhoInvited: boolean;
}

/** GET /public/invites/:code: the landing page for /i/<code>. First name and Hood only. */
export interface PublicInvite {
  code: string;
  inviter: { firstName: string };
  hood: { name: string; city?: string } | null;
}

export interface InviteLeaderboard {
  totals: { joined: number; verified: number };
  people: { uid: string; displayName: string; code?: string; hood?: { id: string; name: string }; joined: number; verified: number; flagged: number }[];
  hoods: { id: string; name: string; joined: number; verified: number }[];
}

type Row = User & { _id: unknown };

/** Verified address and the age check: the only invitees that count (plan WP-E rules). */
const COUNTS = { $and: [{ $eq: ["$verificationStatus", "verified"] }, { $ne: [{ $ifNull: ["$ageConfirmedAt", null] }, null] }] };
const countsFor = (u: Pick<User, "verificationStatus" | "ageConfirmedAt">) => u.verificationStatus === "verified" && Boolean(u.ageConfirmedAt);

/**
 * Invite codes and who brought whom (docs/product/hood-activation-plan.md WP-E, contract §40). Every
 * neighbour has a short code; every path (their link, a shared post, a QR poster, typing it in, "Who
 * invited you?") ends in `claim`. The first code wins, nobody invites themselves, and an invite only
 * counts once the person it brought has verified their address and passed the age check.
 */
@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly hoods: HoodsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private get appUrl(): string {
    return this.config.get<string>("appUrl") ?? "https://myhoodora.com";
  }

  /** One-way, salted: equal inputs match, but the device id or address can't be read back. */
  private hash(kind: "device" | "ip", value: string | undefined): string | undefined {
    if (!value) return undefined;
    const salt = process.env.INVITE_HASH_SALT || this.appUrl;
    return createHash("sha256").update(`${salt}|${kind}|${value}`).digest("base64url").slice(0, 22);
  }

  /** Their code, made the first time it's asked for. */
  async codeFor(uid: string): Promise<string> {
    const user = await this.users.findOne({ uid }).select({ inviteCode: 1, displayName: 1, accountKind: 1 }).lean<Row>().exec();
    if (!user) throw new NotFoundException("Account not found.");
    if (user.accountKind === "team") throw new ForbiddenException("The Hood Team doesn't invite people.");
    if (user.inviteCode) return user.inviteCode;
    // Two random characters first (31² per name start); longer if that name is crowded.
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = makeInviteCode(user.displayName, 2 + Math.floor(attempt / 4));
      try {
        const res = await this.users.updateOne({ uid, inviteCode: { $exists: false } }, { $set: { inviteCode: code } }).exec();
        if (res.modifiedCount) return code;
        // Another request gave them one a moment ago.
        const again = await this.users.findOne({ uid }).select({ inviteCode: 1 }).lean<Row>().exec();
        if (again?.inviteCode) return again.inviteCode;
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
    throw new ConflictException("Couldn't make an invite code just now. Try again.");
  }

  async summary(viewer: Viewer, device?: string): Promise<InviteSummary> {
    const code = await this.codeFor(viewer.uid);
    // Their own phone/browser: an invite claimed from it later is to themselves (invite-flags.ts).
    const deviceHash = device && DEVICE_ID.test(device) ? this.hash("device", device) : undefined;
    if (deviceHash) await this.users.updateOne({ uid: viewer.uid }, { $set: { inviteDeviceHash: deviceHash } }).exec();
    const me = (await this.users.findOne({ uid: viewer.uid }).lean<Row>().exec())!;
    const [people, totals, inviter] = await Promise.all([
      this.users.find({ "invitedBy.uid": viewer.uid, purgedAt: null }).sort({ createdAt: -1 }).limit(20).lean<Row[]>().exec(),
      this.users
        .aggregate<{ joined: number; verified: number; inMyHood: number }>([
          { $match: { "invitedBy.uid": viewer.uid, purgedAt: null } },
          {
            $group: {
              _id: null,
              joined: { $sum: 1 },
              verified: { $sum: { $cond: [COUNTS, 1, 0] } },
              inMyHood: { $sum: { $cond: [{ $and: [COUNTS, { $eq: ["$neighborhoodId", me.neighborhoodId ?? "-"] }] }, 1, 0] } },
            },
          },
        ])
        .exec(),
      me.invitedBy ? this.users.findOne({ uid: me.invitedBy.uid }).select({ displayName: 1 }).lean<Row>().exec() : null,
    ]);
    const hoods = await this.hoods.findManyByIds([...new Set(people.map((p) => p.neighborhoodId).filter(Boolean) as string[])]);
    const t = totals[0];
    return {
      code,
      link: `${this.appUrl}/i/${code}`,
      joined: t?.joined ?? 0,
      verified: t?.verified ?? 0,
      verifiedInMyHood: t?.inMyHood ?? 0,
      people: people.map((p) => ({
        name: shortName(p.displayName),
        ...(countsFor(p) && p.neighborhoodId && hoods.get(p.neighborhoodId) && { hoodName: hoods.get(p.neighborhoodId)!.name }),
        verified: countsFor(p),
        joinedAt: (p.createdAt ?? new Date()).toISOString(),
      })),
      invitedBy: me.invitedBy ? { name: firstName(inviter?.displayName) } : null,
      askWhoInvited: !me.invitedBy && !me.inviteAskDismissedAt && me.accountKind !== "team" && canStillClaim(me.createdAt),
    };
  }

  /** The landing page for a personal link. Unknown or closed accounts: 404. */
  async publicInvite(raw: string): Promise<PublicInvite> {
    const code = normaliseCode(raw);
    const inviter = code ? await this.users.findOne({ inviteCode: code, purgedAt: null, deactivatedAt: null }).lean<Row>().exec() : null;
    if (!code || !inviter) throw new NotFoundException("That invite code isn't one we know.");
    const hood = inviter.verificationStatus === "verified" && inviter.neighborhoodId ? (await this.hoods.findManyByIds([inviter.neighborhoodId])).get(inviter.neighborhoodId) : undefined;
    return { code, inviter: { firstName: firstName(inviter.displayName) }, hood: hood ? { name: hood.name, city: hood.city } : null };
  }

  /**
   * "Ada invited me": by code (every path), or by picking a neighbour from their Hood ("Who invited
   * you?", `uid`). The first answer stays; repeating the same one is fine.
   */
  async claim(viewer: Viewer, input: { code?: string; uid?: string; via: InviteVia; device?: string }, ip?: string): Promise<{ invitedBy: { name: string } }> {
    const me = await this.users.findOne({ uid: viewer.uid }).lean<Row>().exec();
    if (!me) throw new NotFoundException("Account not found.");
    const code = normaliseCode(input.code);
    let inviter: Row | null = null;
    if (code) inviter = await this.users.findOne({ inviteCode: code, purgedAt: null, deactivatedAt: null }).lean<Row>().exec();
    else if (input.uid) {
      // Picked from "neighbours in your Hood": only a verified neighbour there.
      inviter = me.neighborhoodId ? await this.users.findOne({ uid: input.uid, neighborhoodId: me.neighborhoodId, verificationStatus: "verified", purgedAt: null }).lean<Row>().exec() : null;
    } else throw new BadRequestException("Enter the invite code, or pick who invited you.");
    if (!inviter) throw new NotFoundException(code ? "That invite code isn't one we know. Check it and try again." : "We couldn't find that neighbour.");
    if (inviter.uid === me.uid) throw new BadRequestException("That's your own invite code.");
    if (inviter.accountKind === "team") throw new BadRequestException("That isn't a neighbour's invite code.");
    if (me.invitedBy) {
      if (me.invitedBy.uid === inviter.uid) return { invitedBy: { name: firstName(inviter.displayName) } };
      throw new ConflictException("You've already told us who invited you.");
    }
    if (!canStillClaim(me.createdAt)) throw new BadRequestException("Invite codes are for neighbours who joined in the last 30 days.");
    // Two people can't each be the other's inviter.
    if (inviter.invitedBy?.uid === me.uid) throw new BadRequestException("You invited them, so they can't have invited you.");

    const invitedBy = {
      uid: inviter.uid,
      code: inviter.inviteCode ?? (await this.codeFor(inviter.uid)),
      via: input.via,
      at: new Date(),
      vouched: inviter.verificationStatus === "verified",
      deviceHash: input.device && DEVICE_ID.test(input.device) ? this.hash("device", input.device) : undefined,
      ipHash: this.hash("ip", ip),
    };
    const res = await this.users.updateOne({ uid: me.uid, invitedBy: null }, { $set: { invitedBy } }).exec();
    if (!res.modifiedCount) throw new ConflictException("You've already told us who invited you.");
    return { invitedBy: { name: firstName(inviter.displayName) } };
  }

  async dismissAsk(viewer: Viewer): Promise<void> {
    await this.users.updateOne({ uid: viewer.uid, inviteAskDismissedAt: null }, { $set: { inviteAskDismissedAt: new Date() } }).exec();
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  /** Top inviters and Hoods. `from`: invites made since (default: the challenge start). */
  async leaderboard(q: { from?: string; hoodId?: string; limit?: number }): Promise<InviteLeaderboard> {
    const match: PipelineStage.Match["$match"] = { "invitedBy.uid": { $type: "string" }, purgedAt: null, ...(q.from && { "invitedBy.at": { $gte: new Date(q.from) } }) };
    const byInviter: PipelineStage[] = [
      { $match: match },
      { $group: { _id: "$invitedBy.uid", joined: { $sum: 1 }, verified: { $sum: { $cond: [COUNTS, 1, 0] } } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "uid", as: "inviter", pipeline: [{ $project: { displayName: 1, inviteCode: 1, neighborhoodId: 1 } }] } },
      { $unwind: { path: "$inviter", preserveNullAndEmptyArrays: true } },
      ...(q.hoodId ? [{ $match: { "inviter.neighborhoodId": q.hoodId } }] : []),
    ];
    const [people, hoodsAgg, totals] = await Promise.all([
      this.users.aggregate<{ _id: string; joined: number; verified: number; inviter?: Row }>([...byInviter, { $sort: { verified: -1, joined: -1, _id: 1 } }, { $limit: q.limit ?? 50 }]).exec(),
      this.users
        .aggregate<{ _id: string; joined: number; verified: number }>([
          ...byInviter,
          { $match: { "inviter.neighborhoodId": { $type: "string" } } },
          { $group: { _id: "$inviter.neighborhoodId", joined: { $sum: "$joined" }, verified: { $sum: "$verified" } } },
          { $sort: { verified: -1, joined: -1 } },
          { $limit: 50 },
        ])
        .exec(),
      this.users.aggregate<{ joined: number; verified: number }>([...byInviter, { $group: { _id: null, joined: { $sum: "$joined" }, verified: { $sum: "$verified" } } }]).exec(),
    ]);
    const hoods = await this.hoods.findManyByIds([...new Set([...hoodsAgg.map((h) => h._id), ...(people.map((p) => p.inviter?.neighborhoodId).filter(Boolean) as string[])])]);
    const ref = (id?: string) => (id && hoods.get(id) ? { id, name: hoods.get(id)!.name } : undefined);
    const flaggedBy = new Map((await this.flags({ inviterUids: people.map((p) => p._id) })).map((g) => [g.inviter.uid, g.invitees.length]));
    return {
      totals: { joined: totals[0]?.joined ?? 0, verified: totals[0]?.verified ?? 0 },
      people: people.map((p) => ({ uid: p._id, displayName: p.inviter?.displayName ?? "Former neighbour", code: p.inviter?.inviteCode, hood: ref(p.inviter?.neighborhoodId), joined: p.joined, verified: p.verified, flagged: flaggedBy.get(p._id) ?? 0 })),
      hoods: hoodsAgg.map((h) => ({ id: h._id, name: hoods.get(h._id)?.name ?? "Unknown", joined: h.joined, verified: h.verified })),
    };
  }

  /** The leaderboard as CSV, for the offline team. */
  async leaderboardCsv(q: { from?: string; hoodId?: string }): Promise<string> {
    const board = await this.leaderboard({ ...q, limit: 1000 });
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      // Quote everything; a leading = + - @ can't start a formula in a spreadsheet.
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const rows = [["Name", "Invite code", "Hood", "Joined", "Verified", "Flagged"], ...board.people.map((p) => [p.displayName, p.code, p.hood?.name, p.joined, p.verified, p.flagged])];
    return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
  }

  /** Void (code null) or reassign who invited someone. Audited. */
  async setInviter(actor: Viewer, inviteeUid: string, code: string | null, reason: string): Promise<{ invitedBy: { name: string; code: string } | null }> {
    const invitee = await this.users.findOne({ uid: inviteeUid }).lean<Row>().exec();
    if (!invitee) throw new NotFoundException("Neighbour not found.");
    if (code === null) {
      await this.users.updateOne({ uid: inviteeUid }, { $set: { invitedBy: null } }).exec();
      await this.audit.record(actor, "invite_void", { type: "user", id: inviteeUid, label: invitee.displayName ?? "Neighbour" }, { reason });
      return { invitedBy: null };
    }
    const normal = normaliseCode(code);
    const inviter = normal ? await this.users.findOne({ inviteCode: normal, purgedAt: null }).lean<Row>().exec() : null;
    if (!inviter) throw new NotFoundException("That invite code isn't one we know.");
    if (inviter.uid === inviteeUid) throw new BadRequestException("Someone can't invite themselves.");
    await this.users
      .updateOne({ uid: inviteeUid }, { $set: { invitedBy: { uid: inviter.uid, code: normal!, via: invitee.invitedBy?.via ?? "asked", at: invitee.invitedBy?.at ?? new Date(), vouched: inviter.verificationStatus === "verified", by: actor.uid } } })
      .exec();
    await this.audit.record(actor, "invite_reassign", { type: "user", id: inviteeUid, label: invitee.displayName ?? "Neighbour" }, { reason, note: `Now credited to ${inviter.displayName ?? normal}` });
    return { invitedBy: { name: inviter.displayName ?? "Neighbour", code: normal! } };
  }

  /**
   * Invites that look like one person: from the inviter's own phone, several from one phone, or a crowd
   * from one network. Not yet reviewed, from the last 90 days. `inviterUids`: only these inviters.
   */
  async flags(q: { inviterUids?: string[] } = {}): Promise<InviteFlagGroup[]> {
    const rows = await this.users
      .find({
        "invitedBy.uid": q.inviterUids ? { $in: q.inviterUids } : { $type: "string" },
        "invitedBy.reviewedAt": null,
        "invitedBy.at": { $gte: new Date(Date.now() - 90 * 86_400_000) },
        purgedAt: null,
        $or: [{ "invitedBy.deviceHash": { $type: "string" } }, { "invitedBy.ipHash": { $type: "string" } }],
      })
      .select({ uid: 1, displayName: 1, createdAt: 1, verificationStatus: 1, ageConfirmedAt: 1, invitedBy: 1 })
      .limit(5000)
      .lean<Row[]>()
      .exec();
    if (!rows.length) return [];
    const inviterIds = [...new Set(rows.map((r) => r.invitedBy!.uid))];
    const inviters = new Map((await this.users.find({ uid: { $in: inviterIds } }).select({ uid: 1, displayName: 1, inviteCode: 1, inviteDeviceHash: 1 }).lean<Row[]>().exec()).map((u) => [u.uid, u]));
    const flagged = inviteFlags(
      rows.map((r) => ({ uid: r.uid, inviterUid: r.invitedBy!.uid, deviceHash: r.invitedBy!.deviceHash, ipHash: r.invitedBy!.ipHash })),
      new Map([...inviters].map(([uid, u]) => [uid, u.inviteDeviceHash])),
    );
    const groups = new Map<string, InviteFlagGroup>();
    for (const r of rows) {
      const reasons = flagged.get(r.uid);
      if (!reasons) continue;
      const by = r.invitedBy!.uid;
      const inviter = inviters.get(by);
      const g = groups.get(by) ?? { inviter: { uid: by, displayName: inviter?.displayName ?? "Former neighbour", code: inviter?.inviteCode }, reasons: [], invitees: [] };
      g.invitees.push({ uid: r.uid, displayName: r.displayName ?? "Neighbour", joinedAt: (r.createdAt ?? new Date()).toISOString(), verified: countsFor(r), reasons });
      g.reasons = [...new Set([...g.reasons, ...reasons])];
      groups.set(by, g);
    }
    return [...groups.values()].sort((a, b) => b.invitees.length - a.invitees.length);
  }

  /** Staff looked at a flagged invite and it's fine (a family sharing a phone): it stops being flagged. Audited. */
  async markReviewed(actor: Viewer, inviteeUid: string, reason: string): Promise<void> {
    const invitee = await this.users.findOne({ uid: inviteeUid }).lean<Row>().exec();
    if (!invitee?.invitedBy) throw new NotFoundException("This neighbour wasn't invited by anyone.");
    await this.users.updateOne({ uid: inviteeUid }, { $set: { "invitedBy.reviewedAt": new Date(), "invitedBy.reviewedBy": actor.uid } }).exec();
    await this.audit.record(actor, "invite_reviewed", { type: "user", id: inviteeUid, label: invitee.displayName ?? "Neighbour" }, { reason });
  }

  /** Their invite code, who invited them (and whether it looks off), and how many they brought. */
  async staffView(uid: string): Promise<StaffInviteView> {
    const u = await this.users.findOne({ uid }).lean<Row>().exec();
    if (!u) throw new NotFoundException("Neighbour not found.");
    const [inviter, totals, groups] = await Promise.all([
      u.invitedBy ? this.users.findOne({ uid: u.invitedBy.uid }).select({ displayName: 1 }).lean<Row>().exec() : null,
      this.users
        .aggregate<{ joined: number; verified: number }>([{ $match: { "invitedBy.uid": uid, purgedAt: null } }, { $group: { _id: null, joined: { $sum: 1 }, verified: { $sum: { $cond: [COUNTS, 1, 0] } } } }])
        .exec(),
      u.invitedBy ? this.flags({ inviterUids: [u.invitedBy.uid] }) : Promise.resolve([]),
    ]);
    const by = u.invitedBy;
    return {
      code: u.inviteCode ?? null,
      invitedBy: by
        ? { uid: by.uid, displayName: inviter?.displayName ?? "Former neighbour", code: by.code, via: by.via, at: by.at.toISOString(), vouched: Boolean(by.vouched), changedByStaff: Boolean(by.by), reviewed: Boolean(by.reviewedAt) }
        : null,
      flags: groups.flatMap((g) => g.invitees).find((i) => i.uid === uid)?.reasons ?? [],
      joined: totals[0]?.joined ?? 0,
      verified: totals[0]?.verified ?? 0,
    };
  }
}
