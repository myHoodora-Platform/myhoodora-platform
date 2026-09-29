import type { User } from "firebase/auth";
import { isLive } from "../config";
import { actorOf, adminGet, adminSend, forbidden, mock, notFound } from "./http";
import {
  allPosts,
  audit,
  buildReports,
  buildThreads,
  businessRecords,
  businessState,
  hoods,
  neighbours,
  platformSettings,
  recordAudit,
  saveNeighbours,
  savePlatformSettings,
  signupSources,
} from "./mock-db";
import { listAlerts } from "./content";
import type { AdminNeighbour, AdminOverview, AdminRole, Insights, PlatformSettings, SignupEntry } from "./types";

const DAY = 86_400_000;
const within = (iso: string, fromDaysAgo: number, toDaysAgo: number) => {
  const t = Date.now() - new Date(iso).getTime();
  return t >= toDaysAgo * DAY && t < fromDaysAgo * DAY;
};

function medianResolveHours(fromDaysAgo: number, toDaysAgo: number): number {
  const done = buildReports().filter((r) => r.resolution && within(r.resolution.at, fromDaysAgo, toDaysAgo));
  const hours = done.map((r) => (new Date(r.resolution!.at).getTime() - new Date(r.firstReportedAt).getTime()) / 3_600_000).sort((a, b) => a - b);
  if (!hours.length) return 0;
  return Math.round(hours[Math.floor(hours.length / 2)]! * 10) / 10;
}

/** live: GET /admin/overview */
export async function getOverview(user: User): Promise<AdminOverview> {
  if (isLive("admin.overview")) return adminGet(user, "/overview");
  const liveAlerts = await listAlerts(user, { level: "urgent", pageSize: 100 });
  return mock(() => {
    const open = buildReports().filter((r) => r.status === "open" || r.status === "under_review" || r.status === "escalated");
    const ppl = neighbours();
    const posts = allPosts();
    const states = businessState();
    return {
      attention: {
        openReports: open.length,
        urgentReports: open.filter((r) => r.severity === "high").length,
        oldestOpenReportAt: open.map((r) => r.firstReportedAt).sort()[0] ?? null,
        pendingVerifications: ppl.filter((n) => n.verificationStatus === "pending_review" || (n.verificationStatus === "unverified" && n.attempts.length > 0)).length,
        businessApplications: businessRecords().filter((b) => !states[b.id] || states[b.id]!.status === "applied" || states[b.id]!.status === "info_requested").length,
        unansweredInbox: buildThreads().filter((t) => t.status === "open").length,
        liveUrgentAlerts: liveAlerts.total,
      },
      pulse: {
        newNeighbours: { value: ppl.filter((n) => within(n.joinedAt, 7, 0)).length, previous: ppl.filter((n) => within(n.joinedAt, 14, 7)).length },
        posts: { value: posts.filter((p) => within(p.createdAt, 7, 0)).length, previous: posts.filter((p) => within(p.createdAt, 14, 7)).length },
        activeHoods: { value: hoods().filter((h) => h.status === "active" && h.stats.posts7d > 0).length, previous: hoods().filter((h) => h.status === "active").length - 1 },
        medianResolveHours: { value: medianResolveHours(7, 0), previous: medianResolveHours(14, 7) },
      },
      recentActions: audit().slice(0, 8),
    };
  });
}

/** live: GET /admin/insights */
export async function getInsights(user: User): Promise<Insights> {
  if (isLive("admin.insights")) return adminGet(user, "/insights");
  return mock(() => {
    const ppl = neighbours();
    const signups = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10);
      // Seed people + a steady organic baseline so the chart reads like a real launch.
      const seeded = ppl.filter((n) => n.joinedAt.slice(0, 10) === day).length;
      return { day, count: seeded + 3 + ((i * 7) % 6) + Math.floor(i / 6) };
    });
    const reasons = new Map<string, number>();
    buildReports().forEach((r) => r.reasons.forEach((x) => reasons.set(x.reason, (reasons.get(x.reason) ?? 0) + x.count)));
    const started = ppl.length;
    const verified = ppl.filter((n) => n.verificationStatus === "verified").length;
    return {
      signups,
      verifiedFunnel: { started, verified, failed: ppl.filter((n) => n.verificationStatus === "rejected" || n.attempts.some((a) => a.result !== "matched")).length },
      activeByHood: hoods()
        .filter((h) => h.status === "active")
        .map((h) => ({ hood: h.name, members: h.stats.members, posts7d: h.stats.posts7d }))
        .sort((a, b) => b.posts7d - a.posts7d)
        .slice(0, 8),
      reportsByReason: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      medianResolveHours: medianResolveHours(30, 0) || null,
      // planned: kindness-check telemetry isn't collected yet.
      kindnessPrompts: null,
    };
  });
}

// ── Team ────────────────────────────────────────────────────────────────────

/** live: GET /admin/team */
export async function listTeam(user: User): Promise<AdminNeighbour[]> {
  if (isLive("admin.team")) return adminGet(user, "/team");
  return mock(() =>
    neighbours()
      .filter((n) => n.role !== "member")
      .map((n) => ({
        uid: n.uid,
        displayName: n.displayName,
        email: n.email,
        role: n.role,
        verificationStatus: n.verificationStatus,
        accountStatus: n.accountStatus,
        joinedAt: n.joinedAt,
        lastActiveAt: n.lastActiveAt,
        counts: { posts: 0, reportsAgainst: 0, reportsFiled: 0 },
      })),
  );
}

/** live: PATCH /admin/team/:uid (admin only) */
export async function setTeamRole(user: User, uid: string, newRole: "member" | "moderator" | "admin", role: AdminRole): Promise<void> {
  if (isLive("admin.team")) return adminSend(user, `/team/${uid}`, { role: newRole }, "PATCH");
  await mock(() => {
    if (role !== "admin") forbidden();
    const target = neighbours().find((n) => n.uid === uid);
    if (!target) notFound("Neighbour");
    saveNeighbours(neighbours().map((n) => (n.uid === uid ? { ...n, role: newRole } : n)));
    recordAudit(actorOf(user, role), "role_change", { type: "user", id: uid, label: target.displayName }, `${target.role} → ${newRole}`);
  }, 300);
}

// ── Settings & sign-ups ─────────────────────────────────────────────────────

/** live: GET /admin/settings */
export async function getPlatformSettings(user: User): Promise<PlatformSettings> {
  if (isLive("admin.settings")) return adminGet(user, "/settings");
  return mock(() => platformSettings());
}

/** live: PATCH /admin/settings (admin only) */
export async function updatePlatformSettings(user: User, next: PlatformSettings, role: AdminRole): Promise<PlatformSettings> {
  if (isLive("admin.settings")) return adminSend(user, "/settings", next, "PATCH");
  return mock(() => {
    if (role !== "admin") forbidden();
    savePlatformSettings(next);
    return next;
  }, 300);
}

/** live: GET /admin/signups?type */
export async function listSignups(user: User, type: SignupEntry["type"]): Promise<SignupEntry[]> {
  if (isLive("admin.settings")) return adminGet(user, "/signups", { type: type === "ai_pilot" ? "ai_pilot" : "talent" });
  return mock(() => {
    const src = signupSources();
    return type === "ai_pilot"
      ? src.ai.map((a) => ({ id: a.id, type, name: a.name, email: a.email, detail: `${a.institution} · ${a.institutionType}`, at: a.at }))
      : src.talent.map((t) => ({ id: t.id, type, name: t.name, email: t.email, detail: `${t.team} · ${t.city}`, at: t.at }));
  });
}
