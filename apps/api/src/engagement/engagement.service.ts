import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import type { Viewer } from "../shared/auth/viewer";
import { User, type UserDocument } from "../users/schemas/user.schema";
import { computeStreak, lagosDay, type StreakTier } from "./domain/streak";
import { EngagementSettings } from "./engagement-settings.schema";

type Settings = EngagementSettings;
type Badge = NonNullable<NonNullable<User["engagement"]>["badge"]>;

/** Where activity is: who did it, and when. Reactions don't count (too easy to farm). */
const SOURCES = [
  { collection: "posts", uid: "authorUid" },
  { collection: "comments", uid: "authorUid" },
  { collection: "poll_votes", uid: "uid" },
  { collection: "rsvps", uid: "uid" },
] as const;
/** History read for a streak: enough for a 30-day gold run and the week after it. */
const HISTORY_DAYS = 60;
/** How often recently active people are refreshed (badges step down, challenges qualify) without opening the app. */
const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;

/** GET /engagement/me. */
export interface EngagementView {
  streak: { current: number; best: number; tier: StreakTier | null; activeToday: boolean; toNextTier: number | null } | null;
  challenge: {
    name: string;
    startsAt: string;
    endsAt: string | null;
    active: boolean;
    minInvites: number;
    minActiveDays: number;
    invites: number;
    activeDays: number;
    builder: boolean;
    builderSince: string | null;
  } | null;
  badge: Badge | null;
}

export interface EngagementAdminView {
  settings: {
    challengeName: string;
    challengeStartsAt: string;
    challengeEndsAt: string | null;
    minInvites: number;
    minActiveDays: number;
    streaksOn: boolean;
    badgesOn: boolean;
  };
  counts: { builders: number; buildersByStaff: number; streaks: Record<StreakTier, number> };
}

export interface BuilderRow {
  uid: string;
  displayName: string;
  hood?: string;
  since: string;
  by: "auto" | "staff";
  invites: number;
  activeDays: number;
}

/**
 * Streaks, the launch challenge and avatar badges (plan WP-C). Everything is worked out from what people
 * already do (posts, replies, poll votes, RSVPs) and invites, so it counts back to the challenge's start
 * with no backfill job. The result is kept on the user for feeds to show.
 */
@Injectable()
export class EngagementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EngagementService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(EngagementSettings.name) private readonly settingsModel: Model<EngagementSettings>,
    @InjectConnection() private readonly connection: Connection,
    private readonly audit: AuditService,
    private readonly hoods: HoodsService,
  ) {}

  async onModuleInit() {
    // "What did this person do lately?" for poll votes and RSVPs (posts and comments already have one).
    await Promise.all([
      this.connection.collection("poll_votes").createIndex({ uid: 1, createdAt: -1 }),
      this.connection.collection("rsvps").createIndex({ uid: 1, createdAt: -1 }),
      this.connection.collection("posts").createIndex({ authorUid: 1, createdAt: -1 }),
      this.connection.collection("comments").createIndex({ authorUid: 1, createdAt: -1 }),
    ]).catch((err: unknown) => this.logger.warn(`Engagement indexes: ${(err as Error).message}`));
    const run = () => void this.refreshRecent().catch((err: unknown) => this.logger.warn(`Engagement refresh failed: ${(err as Error).message}`));
    this.timer = setInterval(run, REFRESH_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async settings(): Promise<Settings> {
    const doc = await this.settingsModel.findOneAndUpdate({ key: "engagement" }, { $setOnInsert: { key: "engagement" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean<Settings>().exec();
    return doc!;
  }

  /** The Lagos days this person was active since `since`. */
  async activeDays(uid: string, since: Date, until = new Date()): Promise<Set<string>> {
    const days = new Set<string>();
    await Promise.all(
      SOURCES.map(async (s) => {
        const rows = await this.connection
          .collection(s.collection)
          .aggregate<{ _id: string }>([
            { $match: { [s.uid]: uid, createdAt: { $gte: since, $lte: until } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Lagos" } } } },
          ])
          .toArray();
        for (const r of rows) days.add(r._id);
      }),
    );
    return days;
  }

  /** Works out and stores someone's streak, challenge progress and badge. */
  async refresh(uid: string, now = new Date()): Promise<EngagementView> {
    const [user, s] = await Promise.all([this.users.findOne({ uid }).select({ uid: 1, engagement: 1, accountKind: 1, purgedAt: 1 }).lean<User>().exec(), this.settings()]);
    if (!user || user.purgedAt) throw new NotFoundException("Account not found.");
    const end = s.challengeEndsAt && s.challengeEndsAt < now ? s.challengeEndsAt : now;
    const since = new Date(Math.min(s.challengeStartsAt.getTime(), now.getTime() - HISTORY_DAYS * 86_400_000));
    const [days, invites] = await Promise.all([
      this.activeDays(uid, since, now),
      this.users
        .countDocuments({ "invitedBy.uid": uid, verificationStatus: "verified", ageConfirmedAt: { $ne: null }, purgedAt: null, "invitedBy.at": { $gte: s.challengeStartsAt, $lte: end } })
        .exec(),
    ]);
    const today = lagosDay(now);
    const streak = computeStreak(days, today);
    const startDay = lagosDay(s.challengeStartsAt);
    const endDay = lagosDay(end);
    const challengeDays = [...days].filter((d) => d >= startDay && d <= endDay).length;
    const prev = user.engagement;
    const challengeOpen = !s.challengeEndsAt || s.challengeEndsAt > now;
    const qualifies = invites >= s.minInvites || challengeDays >= s.minActiveDays;
    // Earned once, kept (even after the challenge ends); never handed back automatically after staff took it away.
    const builderAt = prev?.builderAt ?? (qualifies && challengeOpen && !prev?.builderRevoked && user.accountKind !== "team" ? now : null);
    const builderBy = prev?.builderAt ? prev.builderBy : builderAt ? "auto" : undefined;
    const engagement: NonNullable<User["engagement"]> = {
      streak: streak.current,
      best: streak.best,
      lastDay: streak.lastDay,
      tier: streak.tier,
      challengeDays,
      challengeInvites: invites,
      builderAt,
      ...(builderBy && { builderBy }),
      ...(prev?.builderRevoked && { builderRevoked: true }),
      badge: null,
      computedAt: now,
    };
    engagement.badge = badgeOf(engagement, s);
    await this.users.updateOne({ uid }, { $set: { engagement } }).exec();
    return this.view(engagement, s, now);
  }

  async me(viewer: Viewer): Promise<EngagementView> {
    return this.refresh(viewer.uid);
  }

  private view(e: NonNullable<User["engagement"]>, s: Settings, now: Date): EngagementView {
    const streakResult = computeStreakView(e);
    return {
      streak: s.streaksOn ? streakResult : null,
      challenge: {
        name: s.challengeName,
        startsAt: s.challengeStartsAt.toISOString(),
        endsAt: s.challengeEndsAt ? s.challengeEndsAt.toISOString() : null,
        active: !s.challengeEndsAt || s.challengeEndsAt > now,
        minInvites: s.minInvites,
        minActiveDays: s.minActiveDays,
        invites: e.challengeInvites,
        activeDays: e.challengeDays,
        builder: Boolean(e.builderAt) && !e.builderRevoked,
        builderSince: e.builderAt && !e.builderRevoked ? new Date(e.builderAt).toISOString() : null,
      },
      badge: s.badgesOn ? e.badge : null,
    };
  }

  /** People active in the last two days, or with a streak or tier that may need to step down. */
  async refreshRecent(now = new Date()): Promise<number> {
    const since = new Date(now.getTime() - 2 * 86_400_000);
    const recent = new Set<string>();
    for (const s of SOURCES) for (const uid of await this.connection.collection(s.collection).distinct(s.uid, { createdAt: { $gte: since } })) recent.add(String(uid));
    for (const u of await this.users.find({ $or: [{ "engagement.streak": { $gt: 0 } }, { "engagement.tier": { $ne: null } }] }).select({ uid: 1 }).limit(20_000).lean<Pick<User, "uid">[]>().exec()) recent.add(u.uid);
    let done = 0;
    for (const uid of recent) {
      await this.refresh(uid, now).then(
        () => done++,
        () => undefined,
      );
    }
    return done;
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  async adminView(): Promise<EngagementAdminView> {
    const s = await this.settings();
    const [builders, byStaff, tiers] = await Promise.all([
      this.users.countDocuments({ "engagement.builderAt": { $ne: null }, "engagement.builderRevoked": { $ne: true }, purgedAt: null }).exec(),
      this.users.countDocuments({ "engagement.builderAt": { $ne: null }, "engagement.builderBy": "staff", "engagement.builderRevoked": { $ne: true } }).exec(),
      this.users.aggregate<{ _id: StreakTier; n: number }>([{ $match: { "engagement.tier": { $in: ["bronze", "silver", "gold"] } } }, { $group: { _id: "$engagement.tier", n: { $sum: 1 } } }]).exec(),
    ]);
    const streaks = { bronze: 0, silver: 0, gold: 0 } as Record<StreakTier, number>;
    for (const t of tiers) streaks[t._id] = t.n;
    return {
      settings: {
        challengeName: s.challengeName,
        challengeStartsAt: s.challengeStartsAt.toISOString(),
        challengeEndsAt: s.challengeEndsAt ? s.challengeEndsAt.toISOString() : null,
        minInvites: s.minInvites,
        minActiveDays: s.minActiveDays,
        streaksOn: s.streaksOn,
        badgesOn: s.badgesOn,
      },
      counts: { builders, buildersByStaff: byStaff, streaks },
    };
  }

  async updateSettings(actor: Viewer, patch: Partial<{ challengeName: string; challengeStartsAt: string; challengeEndsAt: string | null; minInvites: number; minActiveDays: number; streaksOn: boolean; badgesOn: boolean }>): Promise<EngagementAdminView> {
    const set: Record<string, unknown> = { updatedBy: actor.uid };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      set[k] = k === "challengeStartsAt" || k === "challengeEndsAt" ? (v ? new Date(v as string) : null) : v;
    }
    const current = await this.settings();
    const start = (set.challengeStartsAt as Date | undefined) ?? current.challengeStartsAt;
    const end = set.challengeEndsAt === undefined ? current.challengeEndsAt : (set.challengeEndsAt as Date | null);
    if (end && end <= start) throw new BadRequestException("The challenge must end after it starts.");
    await this.settingsModel.updateOne({ key: "engagement" }, { $set: set }, { upsert: true }).exec();
    await this.audit.record(actor, "engagement_settings", { type: "engagement", id: "engagement", label: (set.challengeName as string) ?? current.challengeName }, { note: Object.keys(patch).join(", ") });
    // Badges follow the switches straight away for everyone already showing one.
    if (patch.badgesOn !== undefined || patch.streaksOn !== undefined) await this.rebadgeAll();
    return this.adminView();
  }

  /** "End challenge": from now, no new Builders by themselves; earned badges stay. */
  async endChallenge(actor: Viewer): Promise<EngagementAdminView> {
    return this.updateSettings(actor, { challengeEndsAt: new Date().toISOString() });
  }

  async builders(): Promise<BuilderRow[]> {
    const rows = await this.users
      .find({ "engagement.builderAt": { $ne: null }, "engagement.builderRevoked": { $ne: true }, purgedAt: null })
      .select({ uid: 1, displayName: 1, neighborhoodId: 1, engagement: 1 })
      .sort({ "engagement.builderAt": 1 })
      .limit(5000)
      .lean<User[]>()
      .exec();
    const hoods = await this.hoods.findManyByIds([...new Set(rows.map((r) => r.neighborhoodId).filter(Boolean) as string[])]);
    return rows.map((r) => ({
      uid: r.uid,
      displayName: r.displayName ?? "Neighbour",
      hood: r.neighborhoodId ? hoods.get(r.neighborhoodId)?.name : undefined,
      since: new Date(r.engagement!.builderAt!).toISOString(),
      by: r.engagement!.builderBy ?? "auto",
      invites: r.engagement!.challengeInvites,
      activeDays: r.engagement!.challengeDays,
    }));
  }

  async buildersCsv(): Promise<string> {
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const rows = [["Name", "Hood", "Builder since", "How", "Verified invites", "Active days"], ...(await this.builders()).map((b) => [b.displayName, b.hood, b.since.slice(0, 10), b.by === "staff" ? "Granted by staff" : "Earned", b.invites, b.activeDays])];
    return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
  }

  /** Grant (Leads and moderators chosen offline) or take away the Builder badge. Audited. */
  async setBuilder(actor: Viewer, uid: string, on: boolean, reason: string): Promise<EngagementView> {
    const user = await this.users.findOne({ uid }).select({ uid: 1, displayName: 1 }).lean<User>().exec();
    if (!user) throw new NotFoundException("Neighbour not found.");
    await this.users
      .updateOne(
        { uid },
        on
          ? { $set: { "engagement.builderAt": new Date(), "engagement.builderBy": "staff", "engagement.builderRevoked": false } }
          : { $set: { "engagement.builderAt": null, "engagement.builderRevoked": true }, $unset: { "engagement.builderBy": "" } },
      )
      .exec();
    await this.audit.record(actor, on ? "builder_grant" : "builder_revoke", { type: "user", id: uid, label: user.displayName ?? "Neighbour" }, { reason });
    return this.refresh(uid);
  }

  private async rebadgeAll(): Promise<void> {
    const s = await this.settings();
    const rows = await this.users.find({ engagement: { $ne: null } }).select({ uid: 1, engagement: 1 }).limit(50_000).lean<User[]>().exec();
    for (const r of rows) await this.users.updateOne({ uid: r.uid }, { $set: { "engagement.badge": badgeOf(r.engagement!, s) } }).exec();
  }
}

/** What avatars show: the mascot for a Hood Builder, and the streak tier's ring. Switches off with the kill switches. */
export function badgeOf(e: Pick<NonNullable<User["engagement"]>, "builderAt" | "builderRevoked" | "tier" | "streak">, s: Pick<Settings, "badgesOn" | "streaksOn">): Badge | null {
  if (!s.badgesOn) return null;
  const builder = Boolean(e.builderAt) && !e.builderRevoked;
  const tier = s.streaksOn ? e.tier : null;
  if (!builder && !tier) return null;
  return { ...(builder && { builder: true as const }), ...(tier && { tier }), ...(s.streaksOn && e.streak >= 3 && { streak: e.streak }) };
}

function computeStreakView(e: NonNullable<User["engagement"]>): NonNullable<EngagementView["streak"]> {
  const today = lagosDay(new Date());
  const next = e.streak >= 30 ? null : e.streak >= 7 ? 30 - e.streak : e.streak >= 3 ? 7 - e.streak : 3 - e.streak;
  return { current: e.streak, best: e.best, tier: e.tier, activeToday: e.lastDay === today, toNextTier: next };
}
