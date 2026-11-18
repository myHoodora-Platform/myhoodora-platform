import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Connection, Types } from "mongoose";
import { lagosDay } from "../engagement/domain/streak";
import { FunnelModule, FunnelService } from "../funnel/funnel.module";
import { HOOD_TEAM_UID } from "../hood-content/domain/hood-team";
import { Can } from "../shared/authz/can.decorator";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { challengeAdvice, readiness, type Light } from "./dashboard-rules";

const DAY = 86_400_000;

export interface ActivationRow {
  hood: { id: string; name: string; city?: string };
  light: Light;
  missing: string[];
  neighbours: number;
  /** Posts in the last 30 days, and how many of them the Hood Team wrote. */
  items: number;
  teamItems: number;
  leads: number;
  welcome: boolean;
  moderator: boolean;
}

@Injectable()
export class DashboardsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly funnel: FunnelService,
  ) {}

  private col(name: string) {
    return this.connection.collection(name);
  }

  /** Every open Hood against the "activated" checklist, reddest first. */
  async activation(now = new Date()): Promise<{ rows: ActivationRow[]; counts: Record<Light, number> }> {
    const since = new Date(now.getTime() - 30 * DAY);
    const [hoods, neighbours, posts, leads, assignments] = await Promise.all([
      this.col("neighborhoods").find({ status: "active" }).project<{ _id: Types.ObjectId; name: string; city?: string }>({ name: 1, city: 1 }).toArray(),
      this.col("users").aggregate<{ _id: string; n: number }>([{ $match: { verificationStatus: "verified", purgedAt: null, deactivatedAt: null } }, { $group: { _id: "$neighborhoodId", n: { $sum: 1 } } }]).toArray(),
      this.col("posts")
        .aggregate<{ _id: string; items: number; team: number; welcome: number }>([
          { $match: { isActive: true, removedAt: null, createdAt: { $gte: since } } },
          {
            $group: {
              _id: "$neighborhoodId",
              items: { $sum: 1 },
              team: { $sum: { $cond: [{ $eq: ["$authorUid", HOOD_TEAM_UID] }, 1, 0] } },
              welcome: { $sum: { $cond: [{ $and: [{ $eq: ["$authorUid", HOOD_TEAM_UID] }, { $gt: ["$pinnedUntil", null] }] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
      this.col("hood_roles").aggregate<{ _id: string; n: number }>([{ $group: { _id: "$hoodId", n: { $sum: 1 } } }]).toArray(),
      this.col("hood_assignments").find({}).project<{ hoodIds: string[] }>({ hoodIds: 1 }).toArray(),
    ]);
    // A welcome post ever (pinned or not) also counts: it may have been unpinned since.
    const welcomedEver = new Set((await this.col("posts").distinct("neighborhoodId", { authorUid: HOOD_TEAM_UID, source: "team" })).map(String));
    const by = <T extends { _id: string }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
    const n = by(neighbours);
    const p = by(posts);
    const l = by(leads);
    const moderated = new Set(assignments.flatMap((a) => a.hoodIds));
    const rows = hoods.map((h): ActivationRow => {
      const id = String(h._id);
      const facts = { items: p.get(id)?.items ?? 0, neighbours: n.get(id)?.n ?? 0, leads: l.get(id)?.n ?? 0, welcome: (p.get(id)?.welcome ?? 0) > 0 || welcomedEver.has(id), moderator: moderated.has(id) };
      return { hood: { id, name: h.name, city: h.city }, ...readiness(facts), ...facts, teamItems: p.get(id)?.team ?? 0 };
    });
    const order: Record<Light, number> = { red: 0, amber: 1, green: 2 };
    rows.sort((a, b) => order[a.light] - order[b.light] || b.neighbours - a.neighbours);
    const counts = { red: 0, amber: 0, green: 0 } as Record<Light, number>;
    for (const r of rows) counts[r.light]++;
    return { rows, counts };
  }

  /** The launch challenge at a glance: weekly verified sign-ups from invites, the funnel, and what to do next. */
  async challenge(now = new Date()) {
    const start = (await this.col("engagement_settings").findOne({ key: "engagement" }))?.challengeStartsAt as Date | undefined;
    const from = start ?? new Date("2026-11-16T23:00:00.000Z");
    const weeks = Math.max(1, Math.ceil((now.getTime() - from.getTime()) / (7 * DAY)));
    const joined = await this.col("users")
      .aggregate<{ _id: number; signups: number; invited: number; invitedVerified: number }>([
        { $match: { createdAt: { $gte: from }, purgedAt: null } },
        { $project: { week: { $floor: { $divide: [{ $subtract: ["$createdAt", from] }, 7 * DAY] } }, invited: { $cond: [{ $ifNull: ["$invitedBy.uid", false] }, 1, 0] }, verified: { $cond: [{ $eq: ["$verificationStatus", "verified"] }, 1, 0] } } },
        { $group: { _id: "$week", signups: { $sum: 1 }, invited: { $sum: "$invited" }, invitedVerified: { $sum: { $multiply: ["$invited", "$verified"] } } } },
      ])
      .toArray();
    const byWeek = new Map(joined.map((w) => [w._id, w]));
    const weekly = Array.from({ length: weeks }, (_, i) => ({
      week: lagosDay(new Date(from.getTime() + i * 7 * DAY)),
      signups: byWeek.get(i)?.signups ?? 0,
      invited: byWeek.get(i)?.invited ?? 0,
      invitedVerified: byWeek.get(i)?.invitedVerified ?? 0,
    }));
    const [activation, funnel, builders] = await Promise.all([
      this.activation(now),
      this.funnel.series(from.toISOString()),
      this.col("users").countDocuments({ "engagement.builderAt": { $ne: null }, "engagement.builderRevoked": { $ne: true } }),
    ]);
    const total = Math.max(1, activation.rows.length);
    const advice = challengeAdvice(
      weekly.map((w) => w.invitedVerified),
      activation.counts.green / total,
      activation.counts.red / total,
    );
    return { startedAt: from.toISOString(), weekly, funnel: funnel.totals, builders, hoods: activation.counts, ...advice };
  }
}

/** Admin → Insights: activation per Hood and the launch challenge (contract §46). */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin/dashboards")
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get("activation")
  @ApiOperation({ summary: "Every open Hood against the activated checklist (red, amber, green)" })
  activation() {
    return this.dashboards.activation();
  }

  @Get("challenge")
  @ApiOperation({ summary: "Weekly sign-ups (and from invites), the sharing funnel, Builders, and keep/push/end advice" })
  challenge() {
    return this.dashboards.challenge();
  }
}

@Module({
  imports: [FunnelModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
