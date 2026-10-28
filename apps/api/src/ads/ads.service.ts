import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { searchRegex } from "../shared/http/pagination";
import { StorageService } from "../storage/storage.service";
import { Ad, AdEvent, AdHide, AdSettings, type AdTrackedType, type AdCta, type AdDocument, type AdEventType, type AdFormat, type AdStatus } from "./ad.schema";
import type { AdInputDto, AdSettingsDto } from "./ads.dto";
import { DEFAULT_RULES, type Candidate, type PlacementRules } from "./domain/placement";
import { distanceKm } from "../shared/geo/distance";

const DAY = 86_400_000;
/** Images narrower than this look soft in the feed (§5.1). */
const MIN_IMAGE_WIDTH = 600;

const CTA_LABELS: Record<AdCta, string> = {
  learn_more: "Learn more",
  shop: "Shop now",
  call: "Call",
  visit: "Visit",
  directions: "Get directions",
  sign_up: "Sign up",
  contact: "Contact us",
};

type AdRow = Ad & { _id: Types.ObjectId };

/** What the feed sends for an ad: only what's shown. Never its targeting, stats or internal title. */
export interface AdView {
  _id: string;
  format: AdFormat;
  advertiser: { name: string; logoUrl?: string };
  primaryText: string;
  headline?: string;
  cta: { type: AdCta; label: string; url?: string; phone?: string } | null;
  /** `aspect`: width ÷ height when known, so the app can frame it before it loads. */
  media: { url: string; kind: "image" | "video"; posterUrl?: string; aspect?: number }[];
  cards: { imageUrl: string; headline: string; url: string }[];
  background?: string;
  /** For "Why am I seeing this?". */
  why: string;
}

export interface AdStats {
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  hides: number;
  reports: number;
  /** Videos that started playing, sound turned on, carousels swiped, "Why am I seeing this?" opened. */
  videoPlays: number;
  unmutes: number;
  swipes: number;
  whyOpens: number;
}

export interface AdAdminView extends Omit<Ad, "startsAt" | "endsAt" | "deletedAt" | "createdAt" | "updatedAt"> {
  _id: string;
  /** "ended" once its end date has passed, whatever was set. */
  effectiveStatus: AdStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  stats?: AdStats;
}

/** Midnight in Lagos (WAT, UTC+1, no daylight saving): when daily caps start again. */
export function startOfLagosDay(now: Date): Date {
  const lagos = new Date(now.getTime() + 3_600_000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - 3_600_000);
}

/**
 * Sponsored items (docs/feed-redesign-spec.md §5): admins make and manage them (`ads.manage`, every
 * change audited); the feed asks which ones may be shown to a neighbour; neighbours' impressions,
 * clicks, hides and reports are recorded once each.
 */
@Injectable()
export class AdsService implements OnModuleInit {
  constructor(
    @InjectModel(Ad.name) private readonly ads: Model<AdDocument>,
    @InjectModel(AdEvent.name) private readonly events: Model<AdEvent>,
    @InjectModel(AdHide.name) private readonly hides: Model<AdHide>,
    @InjectModel(AdSettings.name) private readonly settingsModel: Model<AdSettings>,
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly hoods: HoodsService,
  ) {}

  onModuleInit() {
    // An ad's files stay while the ad exists; once deleted, the sweep may take them (its stats stay).
    this.storage.registerReferenceSource({
      name: "ads",
      inUse: async (urls) => {
        const rows = await this.ads
          .find({ deletedAt: null, $or: [{ "media.url": { $in: urls } }, { "media.posterUrl": { $in: urls } }, { "cards.imageUrl": { $in: urls } }, { advertiserLogoUrl: { $in: urls } }] })
          .select({ media: 1, cards: 1, advertiserLogoUrl: 1 })
          .lean<Pick<Ad, "media" | "cards" | "advertiserLogoUrl">[]>()
          .exec();
        return rows.flatMap((r) => [...r.media.flatMap((m) => [m.url, m.posterUrl ?? ""]), ...r.cards.map((c) => c.imageUrl), r.advertiserLogoUrl ?? ""]).filter(Boolean);
      },
    });
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async list(q: { status?: AdStatus; q?: string }): Promise<AdAdminView[]> {
    const filter: QueryFilter<Ad> = { deletedAt: null };
    if (q.status === "ended") filter.$or = [{ status: "ended" }, { endsAt: { $lte: new Date() } }];
    else if (q.status) Object.assign(filter, { status: q.status, $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] });
    const re = searchRegex(q.q);
    if (re) filter.$and = [{ $or: [{ title: re }, { advertiserName: re }] }];
    const rows = await this.ads.find(filter).sort({ updatedAt: -1 }).limit(200).lean<AdRow[]>().exec();
    const stats = await this.statsFor(rows.map((r) => String(r._id)));
    return rows.map((r) => ({ ...this.toAdmin(r), stats: stats.get(String(r._id)) ?? emptyStats() }));
  }

  async get(id: string): Promise<AdAdminView> {
    const row = await this.find(id);
    const stats = await this.statsFor([id]);
    return { ...this.toAdmin(row), stats: stats.get(id) ?? emptyStats() };
  }

  async create(viewer: Viewer, input: AdInputDto): Promise<AdAdminView> {
    const draft = this.merge({ status: "draft", priority: 5, dailyCapPerUser: 3, media: [], cards: [], hoodIds: [], cities: [], near: null, primaryText: "" } as Partial<Ad>, input);
    if (!draft.title || !draft.advertiserName || !draft.format) throw new BadRequestException("An ad needs a name, an advertiser and a format.");
    await this.check(draft, false);
    const created = await withTransaction(this.connection, async (session) => {
      const [doc] = await this.ads.create([{ ...draft, createdBy: viewer.uid }], { session });
      await this.audit.record(viewer, "ad_create", { type: "ad", id: String(doc!._id), label: draft.title! }, {}, session);
      return doc!;
    });
    return this.get(String(created._id));
  }

  async update(viewer: Viewer, id: string, input: AdInputDto): Promise<AdAdminView> {
    const row = await this.find(id);
    const next = this.merge(row, input);
    // A live ad must stay complete; a draft may be finished later.
    await this.check(next, row.status === "active");
    await withTransaction(this.connection, async (session) => {
      await this.ads.updateOne({ _id: row._id }, { $set: this.editable(next) }, { session }).exec();
      await this.audit.record(viewer, "ad_update", { type: "ad", id, label: next.title ?? row.title }, {}, session);
    });
    return this.get(id);
  }

  async setStatus(viewer: Viewer, id: string, status: AdStatus): Promise<AdAdminView> {
    const row = await this.find(id);
    if (status === "active") {
      await this.check(row, true);
      if (row.endsAt && row.endsAt <= new Date()) throw new BadRequestException("Its end date has passed: change the dates first.");
    }
    const action = { active: "ad_activate", paused: "ad_pause", ended: "ad_end", draft: "ad_to_draft" }[status];
    await withTransaction(this.connection, async (session) => {
      await this.ads.updateOne({ _id: row._id }, { $set: { status } }, { session }).exec();
      await this.audit.record(viewer, action, { type: "ad", id, label: row.title }, {}, session);
    });
    return this.get(id);
  }

  /** Soft delete: gone from the feed and the list, its stats kept. */
  async remove(viewer: Viewer, id: string): Promise<void> {
    const row = await this.find(id);
    await withTransaction(this.connection, async (session) => {
      await this.ads.updateOne({ _id: row._id }, { $set: { deletedAt: new Date(), status: "ended" } }, { session }).exec();
      await this.audit.record(viewer, "ad_delete", { type: "ad", id, label: row.title }, {}, session);
    });
  }

  /** Totals for a date range (default: the last 30 days), plus a day-by-day series. */
  async stats(id: string, range: { from?: string; to?: string }): Promise<AdStats & { from: string; to: string; daily: { day: string; impressions: number; clicks: number }[] }> {
    await this.find(id, { includeDeleted: true });
    const to = range.to ? new Date(range.to) : new Date();
    const from = range.from ? new Date(range.from) : new Date(to.getTime() - 30 * DAY);
    if (from > to) throw new BadRequestException("The start date is after the end date.");
    const totals = (await this.statsFor([id], { from, to })).get(id) ?? emptyStats();
    const daily = await this.events.aggregate<{ _id: { day: string; type: AdEventType }; n: number }>([
      { $match: { adId: id, type: { $in: ["impression", "click"] }, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Lagos" } }, type: "$type" }, n: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]);
    const days = new Map<string, { day: string; impressions: number; clicks: number }>();
    for (const d of daily) {
      const row = days.get(d._id.day) ?? { day: d._id.day, impressions: 0, clicks: 0 };
      if (d._id.type === "impression") row.impressions = d.n;
      else row.clicks = d.n;
      days.set(d._id.day, row);
    }
    return { ...totals, from: from.toISOString(), to: to.toISOString(), daily: [...days.values()] };
  }

  async settings(): Promise<PlacementRules & { enabled: boolean }> {
    const doc = await this.settingsModel.findOne({ key: "ads" }).lean<AdSettings>().exec();
    return {
      enabled: doc?.enabled ?? true,
      firstAfter: doc?.firstAfter ?? DEFAULT_RULES.firstAfter,
      minGap: doc?.minGap ?? DEFAULT_RULES.minGap,
      maxGap: doc?.maxGap ?? DEFAULT_RULES.maxGap,
      minOrganic: doc?.minOrganic ?? DEFAULT_RULES.minOrganic,
    };
  }

  async updateSettings(viewer: Viewer, patch: AdSettingsDto): Promise<PlacementRules & { enabled: boolean }> {
    const next = { ...(await this.settings()), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    if (next.minGap > next.maxGap) throw new BadRequestException("The smallest gap can't be bigger than the largest.");
    await withTransaction(this.connection, async (session) => {
      await this.settingsModel.updateOne({ key: "ads" }, { $set: next }, { upsert: true, session }).exec();
      await this.audit.record(viewer, "ad_settings", { type: "ad_settings", id: "ads", label: "Ad placement rules" }, {}, session);
    });
    return this.settings();
  }

  // ── Feed ─────────────────────────────────────────────────────────────────

  /**
   * The ads a neighbour may be shown in this Hood now: live, aimed here, not hidden by them, and with
   * room left under today's cap. One query each for ads, hides and today's impressions.
   */
  async candidatesFor(viewer: Viewer, hood: { id: string; city?: string; lat?: number; lng?: number }, now = new Date()): Promise<{ candidates: Candidate[]; ads: Map<string, AdRow> }> {
    const rows = await this.ads
      .find({
        status: "active",
        deletedAt: null,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
          { $or: [{ hoodIds: { $size: 0 }, cities: { $size: 0 }, near: null }, { hoodIds: hood.id }, ...(hood.city ? [{ cities: hood.city }] : []), { near: { $ne: null } }] },
        ],
      })
      .lean<AdRow[]>()
      .exec()
      // Aimed near a place: only if this neighbourhood is within the radius (or listed or in a listed city).
      .then((found) => found.filter((r) => !r.near || r.hoodIds.includes(hood.id) || (!!hood.city && r.cities.includes(hood.city)) || (hood.lat !== undefined && hood.lng !== undefined && distanceKm(r.near, { lat: hood.lat, lng: hood.lng }) <= r.near.radiusKm)));
    if (!rows.length) return { candidates: [], ads: new Map() };
    const ids = rows.map((r) => String(r._id));
    const [hidden, seen] = await Promise.all([
      this.hides.find({ uid: viewer.uid, adId: { $in: ids } }).select({ adId: 1 }).lean<Pick<AdHide, "adId">[]>().exec(),
      this.events.aggregate<{ _id: string; n: number }>([
        { $match: { uid: viewer.uid, type: "impression", adId: { $in: ids }, createdAt: { $gte: startOfLagosDay(now) } } },
        { $group: { _id: "$adId", n: { $sum: 1 } } },
      ]),
    ]);
    const hiddenIds = new Set(hidden.map((h) => h.adId));
    const today = new Map(seen.map((s) => [s._id, s.n]));
    const open = rows.filter((r) => !hiddenIds.has(String(r._id)));
    return {
      candidates: open.map((r) => ({ id: String(r._id), format: r.format, priority: r.priority, remainingToday: r.dailyCapPerUser - (today.get(String(r._id)) ?? 0) })),
      ads: new Map(open.map((r) => [String(r._id), r])),
    };
  }

  toView(r: AdRow, hoodName?: string, aspects?: Map<string, number>): AdView {
    const aimed = r.hoodIds.length || r.cities.length || r.near;
    return {
      _id: String(r._id),
      format: r.format,
      advertiser: { name: r.advertiserName, logoUrl: r.advertiserLogoUrl },
      primaryText: r.primaryText,
      headline: r.headline,
      cta: r.ctaType ? { type: r.ctaType, label: CTA_LABELS[r.ctaType], url: r.ctaUrl, phone: r.ctaPhone } : null,
      media: r.media.map((m) => ({ url: m.url, kind: m.kind, posterUrl: m.posterUrl, aspect: aspects?.get(m.url) })),
      cards: r.cards.map((c) => ({ imageUrl: c.imageUrl, headline: c.headline, url: c.url })),
      background: r.background,
      why: r.near?.label && !r.hoodIds.length && !r.cities.length ? `You're seeing this because ${r.advertiserName} chose to reach neighbourhoods within ${r.near.radiusKm} km of ${r.near.label}. Ads never use your posts, messages or exact location.` : aimed && hoodName ? `You're seeing this because ${r.advertiserName} chose to reach neighbours in ${hoodName}. Ads never use your posts, messages or exact location.` : `You're seeing this because ${r.advertiserName} is shown to neighbours across myHoodora. Ads never use your posts, messages or exact location.`,
    };
  }

  // ── What neighbours do ───────────────────────────────────────────────────

  /** Impressions and clicks, a batch at a time. Each counts once per neighbour, ad, feed session and kind. */
  async record(viewer: Viewer, batch: { adId: string; type: AdTrackedType; sessionId: string }[]): Promise<{ recorded: number }> {
    const known = new Set((await this.ads.find({ _id: { $in: [...new Set(batch.map((e) => e.adId))] } }).select({ _id: 1 }).lean<{ _id: Types.ObjectId }[]>().exec()).map((a) => String(a._id)));
    const rows = batch
      .filter((e) => known.has(e.adId))
      .map((e) => ({ adId: e.adId, uid: viewer.uid, type: e.type, sessionId: e.sessionId, key: `${viewer.uid}:${e.adId}:${e.sessionId}:${e.type}`, hoodId: viewer.hoodId ?? undefined }));
    return { recorded: await this.insertOnce(rows) };
  }

  /** "Hide ad": never shown to them again. Repeat-safe. */
  async hide(viewer: Viewer, id: string, sessionId?: string): Promise<{ hidden: true }> {
    await this.find(id, { includeDeleted: true });
    await this.hides.updateOne({ uid: viewer.uid, adId: id }, { $setOnInsert: { uid: viewer.uid, adId: id } }, { upsert: true }).exec();
    await this.insertOnce([{ adId: id, uid: viewer.uid, type: "hide", sessionId: sessionId ?? "-", key: `${viewer.uid}:${id}:hide`, hoodId: viewer.hoodId ?? undefined }]);
    return { hidden: true };
  }

  /** "Report ad": counted once per neighbour (shown in the ad's stats), and the ad is hidden for them. */
  async report(viewer: Viewer, id: string, reason: string, sessionId?: string): Promise<{ reported: true }> {
    await this.find(id, { includeDeleted: true });
    await this.insertOnce([{ adId: id, uid: viewer.uid, type: "report", sessionId: sessionId ?? "-", key: `${viewer.uid}:${id}:report`, hoodId: viewer.hoodId ?? undefined, reason }]);
    await this.hide(viewer, id, sessionId);
    return { reported: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Inserts what isn't there yet; a key already recorded is skipped, not an error. */
  private async insertOnce(rows: Partial<AdEvent>[]): Promise<number> {
    if (!rows.length) return 0;
    try {
      return (await this.events.insertMany(rows, { ordered: false })).length;
    } catch (err) {
      const e = err as { code?: number; writeErrors?: { code?: number; err?: { code?: number } }[]; insertedDocs?: unknown[]; result?: { insertedCount?: number } };
      const errors = e.writeErrors ?? [];
      const onlyDuplicates = e.code === 11000 || (errors.length > 0 && errors.every((w) => (w.code ?? w.err?.code) === 11000));
      if (!onlyDuplicates) throw err;
      return e.insertedDocs?.length ?? e.result?.insertedCount ?? 0;
    }
  }

  private async find(id: string, opts: { includeDeleted?: boolean } = {}): Promise<AdRow> {
    const row = Types.ObjectId.isValid(id) ? await this.ads.findOne({ _id: id, ...(!opts.includeDeleted && { deletedAt: null }) }).lean<AdRow>().exec() : null;
    if (!row) throw new NotFoundException("Ad not found.");
    return row;
  }

  private merge(base: Partial<Ad>, input: AdInputDto): Partial<Ad> {
    const next: Partial<Ad> = { ...base };
    for (const [k, v] of Object.entries(input) as [keyof AdInputDto, unknown][]) {
      if (v === undefined) continue;
      if (k === "startsAt" || k === "endsAt") (next as Record<string, unknown>)[k] = v ? new Date(v as string) : null;
      else (next as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
    }
    // Cities compare as written by hoods ("Lagos"): trimmed, no duplicates.
    if (input.cities) next.cities = [...new Set(input.cities.map((c) => c.trim()).filter(Boolean))];
    if (input.hoodIds) next.hoodIds = [...new Set(input.hoodIds)];
    return next;
  }

  private editable(a: Partial<Ad>): Partial<Ad> {
    const { title, advertiserName, advertiserLogoUrl, format, primaryText, headline, ctaType, ctaUrl, ctaPhone, media, cards, background, startsAt, endsAt, priority, dailyCapPerUser, hoodIds, cities, near } = a;
    return { title, advertiserName, advertiserLogoUrl, format, primaryText, headline, ctaType, ctaUrl, ctaPhone, media, cards, background, startsAt, endsAt, priority, dailyCapPerUser, hoodIds, cities, near: near ?? null };
  }

  /**
   * Media must be files we stored (type, size and dimensions checked on upload, and kept by the
   * storage sweep only while an ad uses them). With `complete`, everything its format needs to go live.
   */
  private async check(a: Partial<Ad>, complete: boolean): Promise<void> {
    const problems: string[] = [];
    if (a.startsAt && a.endsAt && a.startsAt >= a.endsAt) problems.push("The end date must be after the start date.");

    const urls = [...(a.media ?? []).flatMap((m) => [m.url, m.posterUrl ?? ""]), ...(a.cards ?? []).map((c) => c.imageUrl), a.advertiserLogoUrl ?? ""].filter(Boolean);
    const stored = await this.storage.describe(urls);
    for (const url of urls) if (!stored.has(url)) problems.push("Upload ad images and videos through myHoodora (pasted links aren't accepted).");
    for (const m of a.media ?? []) {
      const s = stored.get(m.url);
      if (s && s.resourceType !== m.kind) problems.push(`That file is ${s.resourceType === "video" ? "a video" : "an image"}, not ${m.kind === "video" ? "a video" : "an image"}.`);
      if (s && m.kind === "image" && (s.width ?? 0) < MIN_IMAGE_WIDTH) problems.push(`Ad images must be at least ${MIN_IMAGE_WIDTH}px wide.`);
    }
    for (const c of a.cards ?? []) {
      const s = stored.get(c.imageUrl);
      if (s && (s.resourceType !== "image" || (s.width ?? 0) < MIN_IMAGE_WIDTH)) problems.push(`Carousel cards need images at least ${MIN_IMAGE_WIDTH}px wide.`);
    }
    if (a.hoodIds?.length) {
      const found = await this.hoods.findManyByIds(a.hoodIds);
      if (found.size !== a.hoodIds.length) problems.push("One of those neighbourhoods doesn't exist.");
    }

    if (complete) {
      const f = a.format;
      const media = a.media ?? [];
      if (f !== "announcement" && f !== "carousel" && !a.primaryText) problems.push("Write the ad's text.");
      if (f === "announcement" && !a.primaryText) problems.push("Write the announcement.");
      if ((f === "image" || f === "business") && (media.length !== 1 || media[0]!.kind !== "image")) problems.push("Add one image.");
      if (f === "video" && (media.length !== 1 || media[0]!.kind !== "video" || !media[0]!.posterUrl)) problems.push("Add one video and its poster image.");
      if (f === "carousel" && ((a.cards?.length ?? 0) < 2 || (a.cards?.length ?? 0) > 10)) problems.push("A carousel needs 2 to 10 cards.");
      if (f === "announcement" && media.length) problems.push("Announcements are text only.");
      if (f === "business" && !a.advertiserLogoUrl) problems.push("Add the business's logo.");
      if ((f === "image" || f === "video" || f === "business") && !a.ctaType) problems.push("Choose what the button does.");
      if (a.ctaType === "call" && !a.ctaPhone) problems.push("Add the phone number to call.");
      if (a.ctaType && a.ctaType !== "call" && !a.ctaUrl) problems.push("Add the link the button opens.");
    }
    if (problems.length) throw new BadRequestException([...new Set(problems)].join(" "));
  }

  private toAdmin(r: AdRow): AdAdminView {
    const ended = r.status === "ended" || (r.endsAt ? r.endsAt <= new Date() : false);
    return {
      ...r,
      _id: String(r._id),
      effectiveStatus: ended ? "ended" : r.status,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }

  /** Impressions, unique reach, clicks, CTR, hides and reports for these ads (in a date range, if given). */
  private async statsFor(ids: string[], range?: { from: Date; to: Date }): Promise<Map<string, AdStats>> {
    if (!ids.length) return new Map();
    const rows = await this.events.aggregate<{ _id: { adId: string; type: AdEventType }; n: number; people: number }>([
      { $match: { adId: { $in: ids }, ...(range && { createdAt: { $gte: range.from, $lte: range.to } }) } },
      { $group: { _id: { adId: "$adId", type: "$type" }, n: { $sum: 1 }, uids: { $addToSet: "$uid" } } },
      { $project: { n: 1, people: { $size: "$uids" } } },
    ]);
    const out = new Map<string, AdStats>();
    for (const r of rows) {
      const s = out.get(r._id.adId) ?? emptyStats();
      if (r._id.type === "impression") {
        s.impressions = r.n;
        s.reach = r.people;
      } else if (r._id.type === "click") s.clicks = r.n;
      else if (r._id.type === "hide") s.hides = r.n;
      else if (r._id.type === "report") s.reports = r.n;
      else if (r._id.type === "video_play") s.videoPlays = r.n;
      else if (r._id.type === "unmute") s.unmutes = r.n;
      else if (r._id.type === "swipe") s.swipes = r.n;
      else if (r._id.type === "why") s.whyOpens = r.n;
      out.set(r._id.adId, s);
    }
    for (const s of out.values()) s.ctr = s.impressions ? Math.round((s.clicks / s.impressions) * 10_000) / 100 : 0;
    return out;
  }
}

function emptyStats(): AdStats {
  return { impressions: 0, reach: 0, clicks: 0, ctr: 0, hides: 0, reports: 0, videoPlays: 0, unmutes: 0, swipes: 0, whyOpens: 0 };
}
