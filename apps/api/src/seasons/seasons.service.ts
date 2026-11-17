import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import type { Viewer } from "../shared/auth/viewer";
import { StorageService } from "../storage/storage.service";
import { Season, type SeasonDocument } from "./season.schema";
import type { SeasonInputDto } from "./seasons.dto";
import { currentSeason, defaultSeasons } from "./seasons-rules";

type Row = Season & { _id: Types.ObjectId };

/** What the apps get in `GET /app-config` (contract §41): nothing for staff only. */
export interface SeasonView {
  key: string;
  startsAt: string;
  endsAt: string;
  effect: Season["effect"];
  intensity: Season["intensity"];
  mascot: Season["mascot"];
  accent: Season["accent"];
  greeting: { title: string; body: string } | null;
  image: { url: string; credit?: string } | null;
  countdownTo: string | null;
}

export interface AdminSeason extends Omit<Season, "startsAt" | "endsAt" | "countdownTo" | "createdAt" | "updatedAt"> {
  _id: string;
  startsAt: string;
  endsAt: string;
  countdownTo: string | null;
  /** On right now. */
  live: boolean;
  updatedAt?: string;
}

/** Festive seasons (plan WP-D): admins set the dates and look; the apps follow `GET /app-config`. */
@Injectable()
export class SeasonsService implements OnModuleInit {
  /** /app-config is asked by every app start: the answer is kept a minute. */
  private cache: { at: number; value: SeasonView | null } | null = null;

  constructor(
    @InjectModel(Season.name) private readonly seasons: Model<SeasonDocument>,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    // This year's Christmas and New Year, once, so the dates are there for admins to check (idempotent).
    const year = new Date().getUTCFullYear();
    for (const s of defaultSeasons(year)) await this.seasons.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true }).exec().catch(() => undefined);
    // An illustration stays in storage while a season uses it.
    this.storage.registerReferenceSource({
      name: "seasons",
      inUse: async (urls) => (await this.seasons.find({ imageUrl: { $in: urls } }).select({ imageUrl: 1 }).lean<Pick<Season, "imageUrl">[]>().exec()).map((s) => s.imageUrl!).filter(Boolean),
    });
  }

  async forApps(now = new Date()): Promise<SeasonView | null> {
    if (this.cache && now.getTime() - this.cache.at < 60_000) return this.cache.value;
    const rows = await this.seasons.find({ enabled: true, endsAt: { $gt: now } }).lean<Row[]>().exec();
    const s = currentSeason(rows, now);
    const value: SeasonView | null = s
      ? {
          key: s.key,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          effect: s.effect,
          intensity: s.intensity,
          mascot: s.mascot,
          accent: s.accent,
          greeting: s.greetingTitle || s.greetingBody ? { title: s.greetingTitle, body: s.greetingBody } : null,
          image: s.imageUrl ? { url: s.imageUrl, ...(s.imageCredit && { credit: s.imageCredit }) } : null,
          countdownTo: s.countdownTo ? s.countdownTo.toISOString() : null,
        }
      : null;
    this.cache = { at: now.getTime(), value };
    return value;
  }

  async list(now = new Date()): Promise<AdminSeason[]> {
    const rows = await this.seasons.find().sort({ startsAt: -1 }).lean<Row[]>().exec();
    return rows.map((r) => this.toAdmin(r, now));
  }

  async create(actor: Viewer, input: SeasonInputDto): Promise<AdminSeason> {
    if (!input.key || !input.label || !input.startsAt || !input.endsAt) throw new BadRequestException("A season needs a key, a name, and start and end times.");
    const doc = this.normalise(input);
    await this.check(doc);
    try {
      const [created] = await this.seasons.create([{ ...doc, updatedBy: actor.uid }]);
      await this.audit.record(actor, "season_create", { type: "season", id: String(created!._id), label: created!.label });
      this.cache = null;
      return this.toAdmin(created!.toObject() as Row);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new ConflictException("There's already a season with that key.");
      throw err;
    }
  }

  async update(actor: Viewer, id: string, input: SeasonInputDto): Promise<AdminSeason> {
    const current = await this.find(id);
    const next = { ...current, ...this.normalise(input) };
    await this.check(next);
    const { _id, createdAt, updatedAt, ...rest } = next;
    void createdAt;
    void updatedAt;
    await this.seasons.updateOne({ _id }, { $set: { ...rest, updatedBy: actor.uid } }).exec();
    await this.audit.record(actor, "season_update", { type: "season", id, label: next.label });
    this.cache = null;
    return this.toAdmin(await this.find(id));
  }

  async remove(actor: Viewer, id: string): Promise<void> {
    const s = await this.find(id);
    await this.seasons.deleteOne({ _id: s._id }).exec();
    await this.audit.record(actor, "season_delete", { type: "season", id, label: s.label });
    this.cache = null;
  }

  private normalise(input: SeasonInputDto): Partial<Season> {
    const out: Partial<Season> & Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      if (k === "startsAt" || k === "endsAt") out[k] = new Date(v as string);
      else if (k === "countdownTo") out.countdownTo = v ? new Date(v as string) : null;
      else if (k === "imageUrl" || k === "imageCredit") out[k] = v === null ? undefined : (v as string).trim();
      else out[k] = typeof v === "string" ? v.trim() : v;
    }
    if (input.imageUrl === null) out.imageUrl = undefined;
    return out;
  }

  private async check(s: Partial<Season>): Promise<void> {
    if (s.startsAt && s.endsAt && s.startsAt >= s.endsAt) throw new BadRequestException("The end must be after the start.");
    if (s.startsAt && s.endsAt && s.endsAt.getTime() - s.startsAt.getTime() > 62 * 86_400_000) throw new BadRequestException("A season can last at most two months.");
    if (s.countdownTo && s.startsAt && s.endsAt && (s.countdownTo < s.startsAt || s.countdownTo > s.endsAt)) throw new BadRequestException("The countdown must end while the season is on.");
    if (s.imageUrl) {
      const stored = await this.storage.describe([s.imageUrl]);
      const file = stored.get(s.imageUrl);
      if (!file || file.resourceType !== "image") throw new BadRequestException("Upload the illustration or GIF through myHoodora (pasted links aren't accepted).");
    }
  }

  private async find(id: string): Promise<Row> {
    const row = Types.ObjectId.isValid(id) ? await this.seasons.findById(id).lean<Row>().exec() : null;
    if (!row) throw new NotFoundException("Season not found.");
    return row;
  }

  private toAdmin(r: Row, now = new Date()): AdminSeason {
    return {
      _id: String(r._id),
      key: r.key,
      label: r.label,
      enabled: r.enabled,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      effect: r.effect,
      intensity: r.intensity,
      mascot: r.mascot,
      accent: r.accent,
      greetingTitle: r.greetingTitle,
      greetingBody: r.greetingBody,
      imageUrl: r.imageUrl,
      imageCredit: r.imageCredit,
      countdownTo: r.countdownTo ? r.countdownTo.toISOString() : null,
      updatedBy: r.updatedBy,
      live: r.enabled && r.startsAt <= now && now < r.endsAt,
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
