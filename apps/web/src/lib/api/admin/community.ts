import type { User } from "firebase/auth";
import { distanceMeters as haversine } from "@/lib/geo";
import { ApiError, apiFetch } from "../client";
import { isLive } from "../config";
import { actorOf, adminGet, adminSend, forbidden, mock, notFound } from "./http";
import {
  allPosts,
  auditFor,
  buildReports,
  hoodById,
  hoods,
  neighbourById,
  neighbours,
  paginate,
  rawReportsBy,
  recordAudit,
  saveHoods,
  saveNeighbours,
  type NeighbourRecord,
} from "./mock-db";
import type {
  AccountStatus,
  AdminHood,
  AdminNeighbour,
  AdminRole,
  CreateHoodInput,
  HoodDetail,
  HoodLead,
  HoodStatus,
  ListQuery,
  NeighbourActionInput,
  NeighbourDetail,
  Page,
  VerificationCase,
  VerificationStatus,
} from "./types";

// ── Neighbours ──────────────────────────────────────────────────────────────

export interface NeighbourQuery extends ListQuery {
  hoodId?: string;
  verification?: VerificationStatus;
  account?: AccountStatus;
  role?: "member" | "moderator" | "admin" | "owner";
}

function toNeighbour(n: NeighbourRecord): AdminNeighbour {
  const reports = buildReports();
  const hood = hoodById(n.hoodId);
  return {
    uid: n.uid,
    displayName: n.displayName,
    email: n.email,
    role: n.role,
    hood: hood && { id: hood.id, name: hood.name },
    verificationStatus: n.verificationStatus,
    accountStatus: n.accountStatus,
    restrictedUntil: n.restrictedUntil,
    joinedAt: n.joinedAt,
    lastActiveAt: n.lastActiveAt,
    counts: {
      posts: allPosts().filter((p) => p.authorUid === n.uid).length,
      reportsAgainst: reports.filter((r) => r.target.authorUid === n.uid).length,
      reportsFiled: rawReportsBy(n.uid).length,
    },
  };
}

/** live: GET /admin/neighbours */
export async function listNeighbours(user: User, query: NeighbourQuery = {}): Promise<Page<AdminNeighbour>> {
  if (isLive("admin.neighbours")) return adminGet(user, "/neighbours", query);
  return mock(() => {
    const rows = neighbours()
      .filter((n) => !query.hoodId || n.hoodId === query.hoodId)
      .filter((n) => !query.verification || n.verificationStatus === query.verification)
      .filter((n) => !query.account || n.accountStatus === query.account)
      .filter((n) => !query.role || n.role === query.role)
      .map(toNeighbour)
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
    return paginate(rows, query, (n) => `${n.displayName} ${n.email} ${n.hood?.name ?? ""}`, {
      name: (a, b) => a.displayName.localeCompare(b.displayName),
      joined: (a, b) => a.joinedAt.localeCompare(b.joinedAt),
      reports: (a, b) => a.counts.reportsAgainst - b.counts.reportsAgainst,
    });
  });
}

/** live: GET /admin/neighbours/:uid */
export async function getNeighbour(user: User, uid: string): Promise<NeighbourDetail> {
  if (isLive("admin.neighbours")) return adminGet(user, `/neighbours/${uid}`);
  return mock(() => {
    const n = neighbourById(uid);
    if (!n) notFound("Neighbour");
    return { ...toNeighbour(n), location: n.location, verificationAttempts: n.attempts, timeline: auditFor("user", uid).sort((a, b) => b.at.localeCompare(a.at)) };
  });
}

const ADMIN_ONLY: NeighbourActionInput["action"][] = ["suspend", "reinstate"];

/** live: POST /admin/neighbours/:uid/actions */
export async function actOnNeighbour(user: User, uid: string, input: NeighbourActionInput, role: AdminRole): Promise<NeighbourDetail> {
  if (isLive("admin.neighbours")) return adminSend(user, `/neighbours/${uid}/actions`, input);
  await mock(() => {
    if ((ADMIN_ONLY.includes(input.action) || (input.days ?? 0) > 7) && role === "moderator") forbidden();
    const target = neighbourById(uid);
    if (!target) notFound("Neighbour");
    if ((input.action === "verify" || input.action === "change_hood") && !input.hoodId) {
      throw new ApiError("Choose a Hood first.", 422, "client");
    }
    const patch: Partial<NeighbourRecord> = (() => {
      switch (input.action) {
        case "verify":
          return { verificationStatus: "verified", hoodId: input.hoodId, requestedHoodId: undefined };
        case "change_hood":
          return { hoodId: input.hoodId };
        case "reject_verification":
          // Declining a join request isn't a verdict on the person: they go
          // back to unverified and can try again (contract §16).
          return target.requestedHoodId
            ? { verificationStatus: "unverified", requestedHoodId: undefined }
            : { verificationStatus: "rejected" };
        case "restrict":
          return { accountStatus: "restricted", restrictedUntil: new Date(Date.now() + (input.days ?? 7) * 86_400_000).toISOString() };
        case "suspend":
          return { accountStatus: "suspended", restrictedUntil: undefined };
        case "reinstate":
          return { accountStatus: "active", restrictedUntil: undefined };
        default:
          return {};
      }
    })();
    saveNeighbours(neighbours().map((n) => (n.uid === uid ? { ...n, ...patch } : n)));
    const reason = input.action === "change_hood" ? `${input.reason} → ${hoodById(input.hoodId)?.name ?? ""}` : input.reason;
    recordAudit(actorOf(user, role), input.action, { type: "user", id: uid, label: target.displayName }, reason, input.note);
  }, 350);
  return getNeighbour(user, uid);
}

/** live: POST /admin/neighbours/bulk */
export async function bulkNeighbours(user: User, uids: string[], input: NeighbourActionInput, role: AdminRole): Promise<void> {
  if (isLive("admin.neighbours")) return adminSend(user, "/neighbours/bulk", { uids, ...input });
  for (const uid of uids) await actOnNeighbour(user, uid, input, role);
}

// ── Verification ────────────────────────────────────────────────────────────

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.round(haversine(a, b));

/** live: GET /admin/verification */
export async function listVerification(user: User, query: ListQuery & { status?: "pending_review" | "failed" } = {}): Promise<Page<VerificationCase>> {
  if (isLive("admin.verification")) return adminGet(user, "/verification", query);
  return mock(() => {
    const cases = neighbours()
      .filter((n) => n.verificationStatus === "pending_review" || (n.verificationStatus === "unverified" && n.attempts.length > 0))
      .map<VerificationCase>((n) => {
        const last = n.attempts[n.attempts.length - 1];
        const point = last?.point ?? { lat: n.location?.lat ?? 0, lng: n.location?.lng ?? 0 };
        return {
          uid: n.uid,
          displayName: n.displayName,
          submittedAt: last?.at ?? n.joinedAt,
          address: n.location?.address ?? last?.address ?? "",
          point,
          nearestHoods: hoods()
            .filter((h) => h.status !== "archived")
            .map((h) => ({ id: h.id, name: h.name, distanceMeters: distanceMeters(point, h.center) }))
            .sort((a, b) => a.distanceMeters - b.distanceMeters)
            .slice(0, 3),
          attempts: n.attempts.length,
          lastError: last && last.result !== "matched" ? last.result : undefined,
          status: n.verificationStatus === "pending_review" ? "pending_review" : "failed",
          requestedHood: (() => {
            const h = n.requestedHoodId ? hoods().find((x) => x.id === n.requestedHoodId) : undefined;
            return h ? { id: h.id, name: h.name } : undefined;
          })(),
        };
      })
      .filter((c) => !query.status || c.status === query.status)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return paginate(cases, query, (c) => `${c.displayName} ${c.address}`);
  });
}

// ── Hoods ───────────────────────────────────────────────────────────────────

function withLiveStats(h: AdminHood): AdminHood {
  const members = neighbours().filter((n) => n.hoodId === h.id);
  const openReports = buildReports().filter(
    (r) => r.target.hoodId === h.id && (r.status === "open" || r.status === "under_review" || r.status === "escalated"),
  ).length;
  return { ...h, stats: { ...h.stats, openReports, members: Math.max(h.stats.members, members.length) } };
}

/** live: GET /admin/hoods */
export async function listHoods(user: User, query: ListQuery & { city?: string; status?: HoodStatus } = {}): Promise<Page<AdminHood>> {
  if (isLive("admin.hoods")) return adminGet(user, "/hoods", query);
  return mock(() => {
    const rows = hoods()
      .map(withLiveStats)
      .filter((h) => !query.city || h.city === query.city)
      .filter((h) => (query.status ? h.status === query.status : h.status !== "archived"));
    return paginate(rows, { sort: "members:desc", ...query }, (h) => `${h.name} ${h.city}`, {
      name: (a, b) => a.name.localeCompare(b.name),
      members: (a, b) => a.stats.members - b.stats.members,
      growth: (a, b) => a.stats.growth7d - b.stats.growth7d,
      reports: (a, b) => a.stats.openReports - b.stats.openReports,
    });
  });
}

/** live: GET /admin/hoods/:id */
export async function getHood(user: User, id: string): Promise<HoodDetail> {
  if (isLive("admin.hoods")) return adminGet(user, `/hoods/${id}`);
  return mock(() => {
    const h = hoodById(id);
    if (!h) notFound("Hood");
    const live = withLiveStats(h);
    const members7d = Array.from({ length: 14 }, (_, i) => {
      const day = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
      const growth = Math.max(0, h.stats.growth7d);
      return { day, members: Math.max(1, Math.round(live.stats.members - growth * ((13 - i) / 7))) };
    });
    return { ...live, members7d, timeline: auditFor("hood", id).sort((a, b) => b.at.localeCompare(a.at)) };
  });
}

/** live: POST /admin/hoods — 409 with overlaps when it clashes with an existing Hood. */
export async function createHood(user: User, input: CreateHoodInput, role: AdminRole): Promise<AdminHood> {
  if (isLive("admin.hoods")) return adminSend(user, "/hoods", input);
  return mock(() => {
    if (role === "moderator") forbidden();
    const all = hoods();
    if (all.some((h) => h.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new ApiError(`A Hood called “${input.name}” already exists.`, 409, "client");
    }
    const overlaps = all.filter((h) => h.status !== "archived" && distanceMeters(h.center, input.center) < h.radiusMeters + input.radiusMeters);
    if (overlaps.length) {
      throw new ApiError(`This area overlaps ${overlaps.map((o) => o.name).join(", ")}. Shrink the radius or move the centre.`, 409, "client");
    }
    const hood: AdminHood = {
      id: `hood-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      ...input,
      status: "active",
      stats: { members: 0, verifiedPct: 0, posts7d: 0, openReports: 0, growth7d: 0 },
      createdAt: new Date().toISOString(),
    };
    saveHoods([...all, hood]);
    recordAudit(actorOf(user, role), "hood_create", { type: "hood", id: hood.id, label: hood.name });
    return hood;
  }, 400);
}

/** live: PATCH /admin/hoods/:id */
export async function updateHood(
  user: User,
  id: string,
  patch: Partial<Pick<AdminHood, "name" | "radiusMeters" | "status" | "description">> & { reason?: string },
  role: AdminRole,
): Promise<HoodDetail> {
  if (isLive("admin.hoods")) return adminSend(user, `/hoods/${id}`, patch, "PATCH");
  await mock(() => {
    if (role === "moderator") forbidden();
    const h = hoodById(id);
    if (!h) notFound("Hood");
    const { reason, ...fields } = patch;
    saveHoods(hoods().map((x) => (x.id === id ? { ...x, ...fields } : x)));
    recordAudit(actorOf(user, role), patch.status === "archived" ? "hood_archive" : "hood_update", { type: "hood", id, label: h.name }, reason);
  }, 350);
  return getHood(user, id);
}

// ── Hood Leads ──────────────────────────────────────────────────────────────

/** live: GET /admin/hoods/:id/leads */
export async function getHoodLeads(user: User, hoodId: string): Promise<HoodLead[]> {
  if (isLive("admin.hoods")) return adminGet(user, `/hoods/${hoodId}/leads`);
  return mock(() => []);
}

/** live: PUT /admin/hoods/:id/leads { uids } (admins). Voting starts once a Hood has 3 active Leads. */
export async function setHoodLeads(user: User, hoodId: string, uids: string[]): Promise<HoodLead[]> {
  if (isLive("admin.hoods")) return apiFetch<HoodLead[]>(user, `/admin/hoods/${hoodId}/leads`, { method: "PUT", json: { uids } });
  return mock(() => []);
}
