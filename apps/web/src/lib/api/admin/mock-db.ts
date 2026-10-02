/**
 * Mock database for the admin (NEXT_PUBLIC_USE_MOCKS / planned endpoints).
 *
 * It reads the SAME store the app writes to — reports filed from the feed,
 * /contact messages, feedback, business applications, posts, comments,
 * listings and groups — and layers admin-only state on top (report status,
 * account status, audit log). Removing content here hides it in the app via
 * mock/moderation-state.
 */
import { decodePostContent, encodePostContent } from "../post-meta";
import { hoursAgo, load, mockId, save } from "../mock/store";
import { MOCK_NEIGHBORHOOD, MOCK_NEIGHBOURS, seedComments, seedGroups, seedListings, seedPosts, type StoredGroup } from "../mock/seed";
import { isRemoved } from "../mock/moderation-state";
import type { ApiPost, Comment, Listing, PostCategory, ReportInput, ReportReason } from "../types";
import { COVERAGE } from "@/lib/coverage";
import type {
  AdminHood,
  AdminReport,
  AuditAction,
  AuditEvent,
  Broadcast,
  BusinessStatus,
  InboxThread,
  ListQuery,
  Page,
  PlatformSettings,
  ReportSeverity,
  ReportStatus,
  ReportTargetType,
  VerificationAttempt,
  AccountStatus,
  VerificationStatus,
} from "./types";

export interface Actor {
  uid: string;
  displayName: string;
  role: string;
}

// ── Generic list helper (mirrors the backend's q/sort/page behaviour) ───────

export function paginate<T>(items: T[], query: ListQuery, text: (item: T) => string, sorters: Record<string, (a: T, b: T) => number> = {}): Page<T> {
  const q = query.q?.trim().toLowerCase();
  let rows = q ? items.filter((i) => text(i).toLowerCase().includes(q)) : items;
  if (query.sort) {
    const [field, dir] = query.sort.split(":");
    const cmp = field ? sorters[field] : undefined;
    if (cmp) rows = [...rows].sort((a, b) => (dir === "desc" ? -cmp(a, b) : cmp(a, b)));
  }
  const pageSize = query.pageSize ?? 25;
  const page = Math.max(1, query.page ?? 1);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length };
}

// ── Hoods ───────────────────────────────────────────────────────────────────

const CENTERS: Record<string, [number, number]> = {
  Ikeja: [6.6018, 3.3515], "Victoria Island": [6.4281, 3.4219], Ikoyi: [6.4541, 3.4336], "Lekki Phase 1": [6.4478, 3.4746],
  Ajah: [6.4698, 3.5852], Yaba: [6.5095, 3.3711], Surulere: [6.4969, 3.3553], Gbagada: [6.555, 3.3894], Magodo: [6.6208, 3.3886],
  Apapa: [6.4489, 3.359], "Festac Town": [6.4667, 3.2833], Ikorodu: [6.6194, 3.5105], Bodija: [7.4352, 3.9133], Dugbe: [7.389, 3.887],
  Mokola: [7.405, 3.895], Agodi: [7.401, 3.912], Jericho: [7.396, 3.865], Challenge: [7.35, 3.88], "Iwo Road": [7.405, 3.938],
  Eleyele: [7.421, 3.858], Apata: [7.369, 3.834], "Ring Road": [7.362, 3.871],
};

export function hoodIdFor(name: string): string {
  return name === MOCK_NEIGHBORHOOD.name ? MOCK_NEIGHBORHOOD._id : `hood-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function seedHoods(): AdminHood[] {
  let i = 0;
  return COVERAGE.flatMap((c) =>
    c.areas.map((name) => {
      i += 1;
      const big = name === "Lekki Phase 1" ? 4 : 1;
      const members = Math.round((60 + ((i * 37) % 180)) * big);
      const [lat, lng] = CENTERS[name] ?? [6.5, 3.4];
      return {
        id: hoodIdFor(name),
        name,
        city: c.city,
        country: "Nigeria",
        center: { lat, lng },
        radiusMeters: 1500 + ((i * 131) % 1500),
        status: name === "Apata" ? "paused" : "active",
        stats: {
          members,
          verifiedPct: 62 + ((i * 7) % 33),
          posts7d: Math.round(members * (0.18 + ((i * 3) % 10) / 100)),
          openReports: 0,
          growth7d: ((i * 11) % 19) - 3,
        },
        createdAt: hoursAgo(24 * (120 - i * 3)),
      } satisfies AdminHood;
    }),
  );
}

export const hoods = () => load<AdminHood[]>("admin-hoods", seedHoods);
export const saveHoods = (list: AdminHood[]) => save("admin-hoods", list);
export const hoodById = (id?: string) => (id ? hoods().find((h) => h.id === id) : undefined);

// ── Neighbours ──────────────────────────────────────────────────────────────

export interface NeighbourRecord {
  uid: string;
  displayName: string;
  email: string;
  role: "member" | "moderator" | "admin" | "owner";
  hoodId?: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  restrictedUntil?: string;
  joinedAt: string;
  lastActiveAt?: string;
  bio?: string;
  location?: { address: string; lat: number; lng: number };
  attempts: VerificationAttempt[];
  /** Asked to join this nearby Hood from outside its boundary. */
  requestedHoodId?: string;
}

function person(
  uid: string,
  displayName: string,
  hood: string | undefined,
  daysAgo: number,
  extra: Partial<NeighbourRecord> = {},
): NeighbourRecord {
  const [lat, lng] = hood ? (CENTERS[hood] ?? [6.5, 3.4]) : [6.52, 3.37];
  return {
    uid,
    displayName,
    email: `${displayName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    role: "member",
    hoodId: hood ? hoodIdFor(hood) : undefined,
    verificationStatus: hood ? "verified" : "unverified",
    accountStatus: "active",
    joinedAt: hoursAgo(24 * daysAgo),
    lastActiveAt: hoursAgo(Math.max(1, daysAgo % 9) * 5),
    location: hood ? { address: `${hood}, ${lat > 7 ? "Ibadan" : "Lagos"}`, lat, lng } : undefined,
    attempts: hood ? [{ at: hoursAgo(24 * daysAgo), address: `${hood}`, point: { lat, lng }, result: "matched" }] : [],
    ...extra,
  };
}

function seedNeighbours(): NeighbourRecord[] {
  const lekki = MOCK_NEIGHBOURS.map((n, i) =>
    person(n.uid, n.displayName, "Lekki Phase 1", 40 + i * 30, { bio: n.bio, lastActiveAt: hoursAgo(1 + i) }),
  );
  return [
    ...lekki,
    person("nb_ngozi_eze", "Ngozi Eze", "Ikoyi", 150, { role: "moderator" }),
    person("nb_chioma", "Chioma Eze", "Ikeja", 260, { role: "admin" }),
    person("nb_segun", "Segun Adekunle", "Bodija", 90),
    person("nb_grace", "Grace Okonkwo", "Dugbe", 80),
    person("nb_halima", "Halima Sani", "Magodo", 37),
    person("nb_ifeanyi", "Ifeanyi Obi", "Surulere", 55),
    person("nb_yetunde", "Yetunde Balogun", "Yaba", 12),
    person("nb_musa", "Musa Abdullahi", "Ikeja", 6),
    person("nb_kemi", "Kemi Adebayo", "Gbagada", 4),
    person("nb_obinna", "Obinna Okeke", "Ajah", 2),
    person("nb_bisi", "Bisi Ogundipe", "Yaba", 120, { accountStatus: "restricted", restrictedUntil: hoursAgo(-24 * 5) }),
    person("nb_quickloans", "Quick Loans NG", "Yaba", 3, { accountStatus: "active", verificationStatus: "verified", bio: "Instant loans, no BVN" }),
    person("nb_yusuf", "Yusuf Aliyu", "Ajah", 140, { accountStatus: "suspended" }),
    person("nb_dayo", "Dayo Ogunleye", "Surulere", 9),
    // Verification queue
    person("nb_chidi", "Chidi Nwosu", undefined, 1, {
      verificationStatus: "pending_review",
      location: { address: "14 Oduduwa Crescent, GRA Ikeja, Lagos", lat: 6.5835, lng: 3.3552 },
      attempts: [
        { at: hoursAgo(30), address: "14 Oduduwa Crescent, GRA Ikeja", point: { lat: 6.5835, lng: 3.3552 }, result: "low_accuracy" },
        { at: hoursAgo(26), address: "14 Oduduwa Crescent, GRA Ikeja", point: { lat: 6.5835, lng: 3.3552 }, result: "mismatch" },
      ],
    }),
    person("nb_amara", "Amara Nnamdi", undefined, 2, {
      verificationStatus: "pending_review",
      location: { address: "5 Diya Street, Gbagada Phase 2, Lagos", lat: 6.5605, lng: 3.3905 },
      attempts: [{ at: hoursAgo(50), address: "5 Diya Street, Gbagada Phase 2", point: { lat: 6.5605, lng: 3.3905 }, result: "mismatch" }],
    }),
    person("nb_tolu", "Tolu Adebayo", undefined, 0.2, {
      verificationStatus: "pending_review",
      requestedHoodId: hoodIdFor("Lekki Phase 1"),
      location: { address: "7 Fola Osibo Road, Lekki, Lagos", lat: 6.4412, lng: 3.4995 },
      attempts: [{ at: hoursAgo(5), address: "7 Fola Osibo Road, Lekki", point: { lat: 6.4412, lng: 3.4995 }, result: "outside_coverage" }],
    }),
    person("nb_peter", "Peter Udoh", undefined, 3, {
      location: { address: "Plot 22, Lugbe, Abuja", lat: 8.97, lng: 7.37 },
      attempts: [{ at: hoursAgo(70), address: "Plot 22, Lugbe, Abuja", point: { lat: 8.97, lng: 7.37 }, result: "outside_coverage" }],
    }),
    person("nb_kunle", "Kunle Bello", undefined, 1, {
      location: { address: "Old Ife Road, Ibadan", lat: 7.418, lng: 3.95 },
      attempts: [{ at: hoursAgo(20), address: "Old Ife Road, Ibadan", point: { lat: 7.418, lng: 3.95 }, result: "low_accuracy" }],
    }),
    person("nb_folake", "Folake Adeyemi", undefined, 0.5),
    person("nb_emeka_c", "Emeka Chukwu", undefined, 5, {
      verificationStatus: "rejected",
      location: { address: "Somewhere in Lekki", lat: 6.44, lng: 3.53 },
      attempts: [{ at: hoursAgo(110), address: "Somewhere in Lekki", point: { lat: 6.44, lng: 3.53 }, result: "mismatch" }],
    }),
  ];
}

export const neighbours = () => load<NeighbourRecord[]>("admin-neighbours", seedNeighbours);
export const saveNeighbours = (list: NeighbourRecord[]) => save("admin-neighbours", list);
export const neighbourById = (uid?: string) => (uid ? neighbours().find((n) => n.uid === uid) : undefined);
export const nameOf = (uid?: string) => neighbourById(uid)?.displayName ?? (uid ? "Unknown neighbour" : "—");

// ── Audit log ───────────────────────────────────────────────────────────────

const STAFF: Actor = { uid: "nb_ngozi_eze", displayName: "Ngozi Eze", role: "moderator" };

function seedAudit(): AuditEvent[] {
  const ev = (h: number, action: AuditAction, target: AuditEvent["target"], reason?: string, actor: Actor = STAFF): AuditEvent => ({
    id: mockId("audit"),
    at: hoursAgo(h),
    actor,
    action,
    target,
    reason,
  });
  return [
    ev(6, "remove_content", { type: "post", id: "ep_old_spam", label: "“Cheap generator repairs, DM…” (spam)" }, "Spam or advertising"),
    ev(20, "keep", { type: "post", id: "mp_general", label: "5-a-side football on Saturdays" }, "No violation"),
    ev(30, "restrict", { type: "user", id: "nb_bisi", label: "Bisi Ogundipe" }, "Repeated hurtful comments"),
    ev(52, "verify", { type: "user", id: "nb_obinna", label: "Obinna Okeke" }, "Address matched manually"),
    ev(70, "suspend", { type: "user", id: "nb_yusuf", label: "Yusuf Aliyu" }, "Scam attempts on For Sale", { uid: "nb_chioma", displayName: "Chioma Eze", role: "admin" }),
    ev(96, "hood_update", { type: "hood", id: hoodIdFor("Apata"), label: "Apata" }, "Paused while boundary is redrawn", { uid: "nb_chioma", displayName: "Chioma Eze", role: "admin" }),
  ];
}

export const audit = () => load<AuditEvent[]>("admin-audit", seedAudit);

export function recordAudit(actor: Actor, action: AuditAction, target: AuditEvent["target"], reason?: string, note?: string): AuditEvent {
  const event: AuditEvent = { id: mockId("audit"), at: new Date().toISOString(), actor, action, target, reason, note };
  save("admin-audit", [event, ...audit()]);
  return event;
}

export const auditFor = (type: string, id: string) => audit().filter((e) => e.target.type === type && e.target.id === id);

// ── Content (app store + admin-only extras from other Hoods) ────────────────

const ex = (id: string, uid: string, hood: string, message: string, category: string, h: number): ApiPost => ({
  _id: id,
  authorUid: uid,
  neighborhoodId: hoodIdFor(hood),
  type: "text",
  content: encodePostContent(message, { category: category as PostCategory }),
  mediaUrls: [],
  likes: [],
  isActive: true,
  createdAt: hoursAgo(h),
  updatedAt: hoursAgo(h),
});

function seedExtraPosts(): ApiPost[] {
  return [
    ex("ep_loans", "nb_quickloans", "Yaba", "Get instant loan up to ₦500k, no BVN, no collateral!! WhatsApp 0803 000 0000 now, only 20 slots left 💰💰", "general", 4),
    ex("ep_harass", "nb_dayo", "Surulere", "The woman in flat 4B is a thief. Everyone should stop buying from her shop and I will make sure she packs out of this street.", "general", 7),
    ex("ep_meters", "nb_musa", "Ikeja", "Breaking: government will disconnect ALL prepaid meters tomorrow. Buy as many units as you can today before prices triple!!", "general", 10),
    ex("ep_abuja", "nb_segun", "Bodija", "Plots of land for sale in Lugbe, Abuja. C of O available. Call me for inspection.", "for_sale", 30),
    ex("ep_welcome", "nb_grace", "Dugbe", "Welcome to all the new neighbours on Dugbe Road! Our residents' meeting is this Saturday at 4pm by the church.", "general", 14),
  ];
}

const extraPosts = () => load<ApiPost[]>("admin-extra-posts", seedExtraPosts);

export const allPosts = () => [...load<ApiPost[]>("posts", seedPosts), ...extraPosts()];

export function decodePost(p: ApiPost) {
  return decodePostContent(p.content, p.type);
}

function seedExtraComments(): Comment[] {
  return [{ _id: "ec_rude", postId: "mp_reco", authorUid: "nb_bisi", content: "Stop begging for free electricians and pay people properly. This estate is full of stingy people.", createdAt: hoursAgo(2), likes: [] }];
}

export const allComments = () => [...load<Comment[]>("comments", seedComments), ...load<Comment[]>("admin-extra-comments", seedExtraComments)];
export const allListings = () => load<Listing[]>("listings", seedListings);
export const allGroups = () => load<StoredGroup[]>("groups", seedGroups);

// ── Reports ─────────────────────────────────────────────────────────────────

type RawReport = ReportInput & { reporterUid: string; createdAt: string };

function seedRawReports(): RawReport[] {
  const r = (targetType: RawReport["targetType"], targetId: string, reason: ReportReason, reporterUid: string, h: number, details?: string): RawReport => ({
    targetType,
    targetId,
    reason,
    reporterUid,
    createdAt: hoursAgo(h),
    details,
  });
  return [
    r("post", "ep_loans", "scam", "nb_yetunde", 3.5, "Loan scam, they ask for a 'processing fee' first."),
    r("post", "ep_loans", "scam", "nb_ifeanyi", 3),
    r("post", "ep_loans", "spam", "nb_dayo", 2.5),
    r("post", "ep_harass", "harassment", "nb_ifeanyi", 6, "Naming and shaming a neighbour, threatening her."),
    r("post", "ep_harass", "harassment", "nb_halima", 5),
    r("post", "ep_meters", "misinformation", "nb_chioma", 9),
    r("post", "ep_meters", "misinformation", "nb_kemi", 8.5),
    r("post", "ep_meters", "misinformation", "nb_obinna", 8),
    r("post", "ep_abuja", "not_local", "nb_grace", 26),
    r("comment", "ec_rude", "harassment", "nb_chidinma", 1.5, "Rude reply on my recommendation request."),
    r("listing", "ml_bike", "scam", "nb_tunde", 11, "Seller insists on a deposit before viewing."),
    r("listing", "ml_bike", "scam", "nb_funke", 10),
    r("user", "nb_quickloans", "scam", "nb_yetunde", 3, "Account only posts loan adverts."),
    r("post", "mp_general", "spam", "nb_ibrahim", 22),
  ];
}

const rawReports = (): RawReport[] => [...load<RawReport[]>("admin-seed-reports", seedRawReports), ...load<RawReport[]>("reports", () => [])];

interface ReportState {
  status?: ReportStatus;
  assignee?: { uid: string; displayName: string };
  resolution?: AdminReport["resolution"];
}

const seedReportState = (): Record<string, ReportState> => ({
  "post:mp_general": { status: "dismissed", resolution: { action: "keep", reason: "No violation", by: "Ngozi Eze", at: hoursAgo(20) } },
  "post:ep_meters": { status: "under_review", assignee: { uid: STAFF.uid, displayName: STAFF.displayName } },
});

export const reportState = () => load<Record<string, ReportState>>("admin-report-state", seedReportState);
export const saveReportState = (s: Record<string, ReportState>) => save("admin-report-state", s);

const SEVERITY: Record<ReportReason, ReportSeverity> = {
  harassment: "high",
  scam: "high",
  misinformation: "high",
  other: "medium",
  spam: "low",
  not_local: "low",
};
const RANK: Record<ReportSeverity, number> = { high: 3, medium: 2, low: 1 };

export function targetInfo(type: ReportTargetType, id: string): { preview: string; authorUid?: string; hoodId?: string } {
  if (type === "post") {
    const p = allPosts().find((x) => x._id === id);
    return p ? { preview: decodePost(p).message, authorUid: p.authorUid, hoodId: p.neighborhoodId } : { preview: "Post no longer exists" };
  }
  if (type === "comment") {
    const c = allComments().find((x) => x._id === id);
    const p = c && allPosts().find((x) => x._id === c.postId);
    return c ? { preview: c.content, authorUid: c.authorUid, hoodId: p?.neighborhoodId } : { preview: "Comment no longer exists" };
  }
  if (type === "listing") {
    const l = allListings().find((x) => x._id === id);
    return l ? { preview: l.title, authorUid: l.sellerUid, hoodId: l.neighborhoodId } : { preview: "Listing no longer exists" };
  }
  if (type === "user") {
    const n = neighbourById(id);
    return { preview: n ? `${n.displayName}${n.bio ? ` · “${n.bio}”` : ""}` : "Account", authorUid: id, hoodId: n?.hoodId };
  }
  if (type === "group") {
    const g = allGroups().find((x) => x._id === id);
    return { preview: g?.name ?? "Group", authorUid: g?.createdBy, hoodId: g?.neighborhoodId };
  }
  return { preview: `${type} ${id}` };
}

export function buildReports(): AdminReport[] {
  const state = reportState();
  const groups = new Map<string, RawReport[]>();
  for (const r of rawReports()) {
    const key = `${r.targetType}:${r.targetId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([id, list]) => {
    const [type, targetId] = id.split(":") as [ReportTargetType, string];
    const reasons = new Map<ReportReason, number>();
    list.forEach((r) => reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1));
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Account reports and any high-risk reason are high severity (staff-only, Nextdoor model).
    const severity = type === "user" ? "high" : list.map((r) => SEVERITY[r.reason]).sort((a, b) => RANK[b] - RANK[a])[0]!;
    const s = state[id] ?? {};
    return {
      id,
      target: { type, id: targetId, ...targetInfo(type, targetId) },
      reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      reporterCount: new Set(list.map((r) => r.reporterUid)).size,
      firstReportedAt: sorted[0]!.createdAt,
      lastReportedAt: sorted[sorted.length - 1]!.createdAt,
      severity,
      status: s.status ?? "open",
      assignee: s.assignee,
      resolution: s.resolution,
    } satisfies AdminReport;
  });
}

export const reportsFor = (type: ReportTargetType, id: string) => rawReports().filter((r) => r.targetType === type && r.targetId === id);
export const rawReportsBy = (uid: string) => rawReports().filter((r) => r.reporterUid === uid);

export function severityRank(s: ReportSeverity) {
  return RANK[s];
}

export function isContentRemoved(type: ReportTargetType, id: string) {
  return type === "post" || type === "comment" || type === "listing" || type === "group" ? isRemoved(type, id) : false;
}

// ── Businesses ──────────────────────────────────────────────────────────────

export interface BusinessRecord {
  id: string;
  businessName: string;
  category: string;
  description: string;
  areasServed: string[];
  address?: string;
  contactName: string;
  phone: string;
  email: string;
  cacNumber?: string;
  wantsAdsUpdates: boolean;
  at: string;
}

function seedBusinessRecords(): BusinessRecord[] {
  const b = (id: string, businessName: string, category: string, description: string, areas: string[], contactName: string, phone: string, h: number, cac?: string): BusinessRecord => ({
    id,
    businessName,
    category,
    description,
    areasServed: areas,
    contactName,
    phone,
    email: `${contactName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    cacNumber: cac,
    wantsAdsUpdates: id.endsWith("1"),
    at: hoursAgo(h),
  });
  return [
    b("biz_femi1", "Femi Electricals", "home_services", "Inverter, solar and house wiring. Same-day fault finding across Lekki and VI.", ["Lekki Phase 1", "Victoria Island"], "Femi Adewale", "+2348031234567", 400, "BN1234567"),
    b("biz_mama2", "Mama Tee's Kitchen", "food", "Party jollof, small chops and weekend food packs.", ["Lekki Phase 1", "Ikoyi"], "Titilayo Ade", "+2348059876543", 300),
    b("biz_glow3", "Glow Beauty Lounge", "beauty", "Hair, nails and bridal makeup. Home service available.", ["Yaba", "Surulere"], "Kike Ojo", "+2348091112233", 20, "RC765432"),
    b("biz_tutor4", "Bright Minds Tutoring", "education", "WAEC, JAMB and primary school lessons at home or online.", ["Bodija", "Agodi"], "Samuel Ade", "+2348064445566", 8),
    b("biz_fix5", "QuickFix Plumbing", "home_services", "24/7 plumbing, borehole and pumping machine repairs.", ["Gbagada", "Magodo", "Ikeja"], "Uche Nnaji", "+2347038889900", 2),
  ];
}

export const businessRecords = (): BusinessRecord[] => [
  ...load<BusinessRecord[]>("admin-businesses", seedBusinessRecords),
  ...load<BusinessRecord[]>("business-applications", () => []),
];

export interface BusinessState {
  status: BusinessStatus;
}

export const businessState = () =>
  load<Record<string, BusinessState>>("admin-business-state", () => ({
    biz_femi1: { status: "verified" },
    biz_mama2: { status: "verified" },
    biz_glow3: { status: "info_requested" },
  }));
export const saveBusinessState = (s: Record<string, BusinessState>) => save("admin-business-state", s);

// ── Inbox ───────────────────────────────────────────────────────────────────

interface ContactMsg {
  id: string;
  topic: string;
  name: string;
  email: string;
  message: string;
  organisation?: string;
  at: string;
}
interface FeedbackMsg {
  uid: string;
  at: string;
  message?: string;
  kind?: string;
  [k: string]: unknown;
}

function seedThreads(): InboxThread[] {
  const t = (id: string, uid: string, subject: string, body: string, status: InboxThread["status"], priority: InboxThread["priority"], h: number, reply?: string): InboxThread => {
    const n = neighbourById(uid);
    return {
      id,
      source: "in_app",
      topic: "account",
      subject,
      from: { uid, name: n?.displayName ?? uid, email: n?.email ?? "" },
      status,
      priority,
      messages: [
        { from: "user", body, at: hoursAgo(h) },
        ...(reply ? [{ from: "staff" as const, body: reply, at: hoursAgo(h - 2), by: "Ngozi Eze" }] : []),
      ],
      createdAt: hoursAgo(h),
      updatedAt: hoursAgo(reply ? h - 2 : h),
    };
  };
  return [
    t("q_chidi", "nb_chidi", "Can't verify my address", "I tried using my current location three times and it keeps failing. My address is correct on the map though.", "open", "high", 20),
    t("q_amara", "nb_amara", "Wrong neighbourhood assigned", "I live in Gbagada but the app matched me to a neighbourhood on the other side of Lagos.", "open", "normal", 40),
    t("q_bisi", "nb_bisi", "Why was my account restricted?", "I woke up and I can't post anymore. Can someone tell me what happened?", "waiting", "high", 28, "Hi Bisi, your account was restricted for 7 days after several reports of hurtful comments. You can still read and message. The restriction lifts automatically."),
    t("q_tunde", "nb_tunde", "Feature request: dark mode", "Loving the app so far! Would be great to have a dark mode option for night use.", "resolved", "low", 200, "Thanks for the suggestion, we've added it to our roadmap!"),
  ];
}

export function buildThreads(): InboxThread[] {
  const overrides = load<Record<string, Partial<InboxThread>>>("admin-inbox-state", () => ({}));
  const contact = load<ContactMsg[]>("contact-messages", () => []).map<InboxThread>((m) => ({
    id: m.id,
    source: "contact_form",
    topic: m.topic,
    subject: `${m.topic[0]!.toUpperCase()}${m.topic.slice(1).replace(/_/g, " ")} enquiry${m.organisation ? ` · ${m.organisation}` : ""}`,
    from: { name: m.name, email: m.email },
    status: "open",
    priority: m.topic === "safety" ? "high" : "normal",
    messages: [{ from: "user", body: m.message, at: m.at }],
    createdAt: m.at,
    updatedAt: m.at,
  }));
  const feedback = load<FeedbackMsg[]>("feedback", () => []).map<InboxThread>((f, i) => ({
    id: `fb_${i}_${f.at}`,
    source: "feedback",
    topic: String(f.kind ?? "feedback"),
    subject: "App feedback",
    from: { uid: f.uid, name: nameOf(f.uid), email: neighbourById(f.uid)?.email ?? "" },
    status: "open",
    priority: "low",
    messages: [{ from: "user", body: String(f.message ?? JSON.stringify(f)), at: f.at }],
    createdAt: f.at,
    updatedAt: f.at,
  }));
  const started = load<InboxThread[]>("admin-inbox-started", () => []);
  return [...seedThreads(), ...started, ...contact, ...feedback].map((t) => ({ ...t, ...overrides[t.id] }) as InboxThread);
}

/** Preview mode: a conversation staff started with a neighbour. */
export function addStartedThread(t: InboxThread) {
  save("admin-inbox-started", [t, ...load<InboxThread[]>("admin-inbox-started", () => [])]);
}

export function patchThread(id: string, patch: Partial<InboxThread>) {
  const all = load<Record<string, Partial<InboxThread>>>("admin-inbox-state", () => ({}));
  save("admin-inbox-state", { ...all, [id]: { ...all[id], ...patch } });
}

// ── Broadcasts, settings, sign-ups ──────────────────────────────────────────

export const broadcasts = () =>
  load<Broadcast[]>("admin-broadcasts", () => [
    { id: "bc_1", title: "Scheduled maintenance tonight", body: "myHoodora will be briefly unavailable between 1–2am WAT for scheduled maintenance.", audience: { type: "all" }, audienceLabel: "Everyone", reach: 2840, sentAt: hoursAgo(40), sentBy: "Chioma Eze" },
    { id: "bc_2", title: "Groups are here", body: "Start or join a group for your street, estate or safety watch.", audience: { type: "hood", hoodIds: [MOCK_NEIGHBORHOOD._id] }, audienceLabel: "Lekki Phase 1", reach: 612, sentAt: hoursAgo(120), sentBy: "Chioma Eze" },
  ]);
export const saveBroadcasts = (list: Broadcast[]) => save("admin-broadcasts", list);

export const platformSettings = () =>
  load<PlatformSettings>("admin-settings", () => ({
    reportReasons: [
      { id: "harassment", label: "Harassment or hate", severity: "high", staffOnly: true },
      { id: "scam", label: "Scam or fraud", severity: "high", staffOnly: true },
      { id: "misinformation", label: "Misinformation", severity: "high", staffOnly: true },
      { id: "other", label: "Something else", severity: "medium", staffOnly: false },
      { id: "spam", label: "Spam or advertising", severity: "low", staffOnly: false },
      { id: "not_local", label: "Not about the neighbourhood", severity: "low", staffOnly: false },
    ],
    coverageCities: COVERAGE.map((c) => ({ city: c.city, hoods: c.areas.length })),
  }));
export const savePlatformSettings = (s: PlatformSettings) => save("admin-settings", s);

export const signupSources = () => ({
  ai: load<{ id: string; name: string; email: string; institution: string; institutionType: string; at: string }[]>("ai-pilot-requests", () => []),
  talent: load<{ id: string; name: string; email: string; team: string; city: string; at: string }[]>("talent-network", () => []),
});

export { isRemoved };
