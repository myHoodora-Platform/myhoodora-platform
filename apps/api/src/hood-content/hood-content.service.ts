import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "node:crypto";
import { Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { Neighborhood, type NeighborhoodDocument } from "../hoods/schemas/hood.schema";
import { JobsService } from "../jobs/jobs.service";
import { BLOCKED_TEXT_MESSAGE, isAllowedText } from "../moderation/content-filter";
import type { CreatePostDto } from "../posts/dto/posts.dto";
import { PostsService } from "../posts/posts.service";
import { FeedPost, type PostDocument } from "../posts/schemas/post.schema";
import type { Viewer } from "../shared/auth/viewer";
import { searchRegex } from "../shared/http/pagination";
import { User, type UserDocument } from "../users/schemas/user.schema";
import { fillTemplate, needsLocalDetails, parseContentBank, pollProblem, textForHood, type HoodDetails, type TeamCategory } from "./domain/content-bank";
import { HOOD_TEAM_PROFILE, HOOD_TEAM_UID, hoodTeamPhotoUrl } from "./domain/hood-team";
import { DEFAULT_ACTIVATION_PLAN, addDays, atWat, rotationPick, watDate, watHour } from "./domain/schedule";
import type { ActivationDto, ComposeDto, ContentItemDto, DailySettingsDto, HoodTargetDto, ImportDto, ItemListQuery, ScheduledListQuery } from "./hood-content.dto";
import { ContentItem, DEFAULT_DAILY, HoodContentSettings, ScheduledPost, type ContentItemDocument, type DailySettings, type HoodContentSettingsDocument, type ScheduledPostDocument } from "./hood-content.schemas";

export const PUBLISH_JOB = "hood-content.publish";
const TICK_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SETTINGS_KEY = "hood-content";
/**
 * The category a Hood Team post goes out as. "For sale" items are prompts ("declutter Saturday!"),
 * not things for sale, and "event" items without a date are questions ("anything on this weekend?"):
 * both post as general. A real event (date and place given in Compose) posts as an event.
 */
export function postedCategory(category: TeamCategory, hasEventDate: boolean): NonNullable<CreatePostDto["category"]> {
  if (category === "for_sale") return "general";
  if (category === "event") return hasEventDate ? "event" : "general";
  return category;
}

type HoodRow = Pick<Neighborhood, "name" | "city" | "status"> & { _id: Types.ObjectId };
type ScheduledDraft = Omit<ScheduledPost, "status" | "createdAt" | "updatedAt"> & { status?: ScheduledPost["status"] };

export interface ScheduleResult {
  batchId: string;
  hoods: number;
  scheduled: number;
  /** Already scheduled (activation, daily), so not added again. */
  alreadyScheduled: number;
  /** Items that still need local details for these cities (add a city version in the content bank). */
  needsLocalDetails: { code: string; cities: string[] }[];
  /** Hoods left alone because they are already active enough (activation only). */
  activeHoods?: number;
}

/**
 * The Hood Team (docs/product/hood-activation-plan.md): the content bank, official posts in any
 * Hood (now or scheduled), the first-ten-days activation plan, and the daily prompt. Every post goes
 * out through the `hood-content.publish` job, so nothing is lost to a restart and a retry never
 * posts twice.
 */
@Injectable()
export class HoodContentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoodContentService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    @InjectModel(ContentItem.name) private readonly items: Model<ContentItemDocument>,
    @InjectModel(ScheduledPost.name) private readonly scheduled: Model<ScheduledPostDocument>,
    @InjectModel(HoodContentSettings.name) private readonly settingsModel: Model<HoodContentSettingsDocument>,
    @InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    private readonly postsService: PostsService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register(PUBLISH_JOB, (payload) => this.publish(String(payload.id)));
    void this.ensureTeamAccount().catch((err: unknown) => this.logger.error(`Couldn't set up the Hood Team account: ${(err as Error).message}`));
    const run = () => void this.dailyTick().catch((err: unknown) => this.logger.warn(`Daily prompt run failed: ${(err as Error).message}`));
    this.timer = setInterval(run, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** The official account exists, with its current name, bio and photo. Safe on every start. */
  async ensureTeamAccount(): Promise<void> {
    const appUrl = this.config.get<string>("appUrl") ?? "https://myhoodora.com";
    await this.users
      .updateOne(
        { uid: HOOD_TEAM_UID },
        {
          $set: { accountKind: "team", displayName: HOOD_TEAM_PROFILE.displayName, bio: HOOD_TEAM_PROFILE.bio, photoURL: hoodTeamPhotoUrl(appUrl) },
          $setOnInsert: { uid: HOOD_TEAM_UID, email: HOOD_TEAM_PROFILE.email, provider: "system", role: "member", verificationStatus: "unverified", accountStatus: "active", isOnboarded: true },
        },
        { upsert: true },
      )
      .exec();
  }

  // ── Content bank ─────────────────────────────────────────────────────────

  async listItems(q: ItemListQuery) {
    const re = searchRegex(q.q);
    const rows = await this.items
      .find({ ...(q.tag && { tag: q.tag }), ...(q.active && { active: q.active === "true" }), ...(re && { $or: [{ code: re }, { body: re }] }) })
      .sort({ code: 1 })
      .limit(1000)
      .lean<(ContentItem & { _id: Types.ObjectId })[]>()
      .exec();
    return rows.map(itemView);
  }

  async createItem(actor: Viewer, dto: ContentItemDto) {
    if (!dto.code || !dto.tag || !dto.category || !dto.body) throw new BadRequestException("A new item needs a code, tag, category and text.");
    this.checkItem(dto.category, dto.pollOptions);
    if (await this.items.exists({ code: dto.code })) throw new BadRequestException(`${dto.code} already exists.`);
    const doc = await this.items.create({ ...dto, pinDays: dto.pinDays ?? undefined, updatedBy: actor.uid });
    await this.audit.record(actor, "hood_content_item_create", { type: "hood_content_item", id: String(doc._id), label: doc.code });
    return itemView(doc.toObject());
  }

  async updateItem(actor: Viewer, id: string, dto: ContentItemDto) {
    const item = await this.items.findById(id).exec();
    if (!item) throw new NotFoundException("Item not found.");
    if (dto.code && dto.code !== item.code && (await this.items.exists({ code: dto.code }))) throw new BadRequestException(`${dto.code} already exists.`);
    const category = dto.category ?? item.category;
    const pollOptions = dto.pollOptions ?? item.pollOptions;
    this.checkItem(category, pollOptions);
    item.set({ ...dto, ...(dto.pinDays === null && { pinDays: undefined }), ...(category !== "poll" && { pollOptions: undefined }), updatedBy: actor.uid });
    await item.save();
    await this.audit.record(actor, "hood_content_item_update", { type: "hood_content_item", id, label: item.code });
    return itemView(item.toObject());
  }

  async deleteItem(actor: Viewer, id: string) {
    const item = await this.items.findByIdAndDelete(id).lean<ContentItem>().exec();
    if (!item) throw new NotFoundException("Item not found.");
    await this.audit.record(actor, "hood_content_item_delete", { type: "hood_content_item", id, label: item.code });
  }

  /** Adds the file's new codes; with `overwrite`, also replaces the text of codes already there (city versions are kept). */
  async importBank(actor: Viewer, dto: ImportDto) {
    const { items, problems } = parseContentBank(dto.markdown);
    const blocked = items.filter((i) => !isAllowedText(i.body) || (i.pollOptions ?? []).some((o) => !isAllowedText(o)));
    const usable = items.filter((i) => !blocked.includes(i));
    const existing = new Set((await this.items.find({ code: { $in: usable.map((i) => i.code) } }).select({ code: 1 }).lean<{ code: string }[]>().exec()).map((r) => r.code));
    let added = 0;
    let updated = 0;
    for (const i of usable) {
      const fields = { tag: i.tag, category: i.category, body: i.body, pollOptions: i.pollOptions, pollDays: i.pollDays, pinDays: i.pinDays, updatedBy: actor.uid };
      if (!existing.has(i.code)) {
        await this.items.create({ code: i.code, ...fields });
        added++;
      } else if (dto.overwrite) {
        await this.items.updateOne({ code: i.code }, { $set: fields, ...(!i.pinDays && { $unset: { pinDays: 1 } }) }).exec();
        updated++;
      }
    }
    await this.audit.record(actor, "hood_content_import", { type: "hood_content_item", id: "bank", label: `${added} added, ${updated} updated` });
    return {
      added,
      updated,
      unchanged: usable.length - added - updated,
      problems: [...problems, ...blocked.map((b) => ({ line: 0, heading: b.code, problem: BLOCKED_TEXT_MESSAGE }))],
    };
  }

  /** GET /hood-content/starters: conversation starters for the composer, filled in for the viewer's Hood. */
  async starters(viewer: Viewer): Promise<{ code: string; category: string; text: string }[]> {
    if (!viewer.hoodId) return [];
    const [hood, rows] = await Promise.all([
      this.hoods.findById(viewer.hoodId).select({ name: 1, city: 1 }).lean<HoodRow>().exec(),
      this.items.find({ tag: "starter", active: true, category: { $in: ["general", "recommendation", "lost_found"] } }).sort({ code: 1 }).lean<ContentItem[]>().exec(),
    ]);
    if (!hood || !rows.length) return [];
    // "Introduce yourself" first, then five that change each day, so the chips don't feel stuck.
    const intro = rows.find((r) => r.code === "S01");
    const rest = rows.filter((r) => r !== intro);
    const offset = Math.floor(Date.now() / DAY_MS) % Math.max(1, rest.length);
    const picked = [...(intro ? [intro] : []), ...[...rest.slice(offset), ...rest.slice(0, offset)].slice(0, intro ? 5 : 6)];
    return picked.flatMap((r) => {
      const text = textForHood(r, hood);
      return text ? [{ code: r.code, category: r.category, text }] : [];
    });
  }

  // ── Posting ──────────────────────────────────────────────────────────────

  /** POST /admin/hood-content/compose: as the Hood Team, now or later, in the chosen Hoods. */
  async compose(actor: Viewer, dto: ComposeDto): Promise<ScheduleResult> {
    const item = dto.itemId ? await this.items.findById(dto.itemId).lean<ContentItem & { _id: Types.ObjectId }>().exec() : null;
    if (dto.itemId && !item) throw new NotFoundException("Item not found.");
    const category = dto.category ?? item?.category ?? "general";
    const pollOptions = category === "poll" ? (dto.pollOptions ?? item?.pollOptions) : undefined;
    this.checkItem(category, pollOptions);
    if (category === "event" && (!dto.eventDate || !dto.eventLocation)) throw new BadRequestException("Events need a date and a place.");
    if (!dto.message && !item) throw new BadRequestException("Write the post, or start from a content bank item.");
    const runAt = dto.runAt ? new Date(dto.runAt) : new Date();
    if (runAt.getTime() < Date.now() - 60_000) throw new BadRequestException("That time has already passed.");
    if (runAt.getTime() > Date.now() + 90 * DAY_MS) throw new BadRequestException("Schedule up to 90 days ahead.");

    const hoods = await this.resolveHoods(dto);
    const batchId = randomUUID();
    const drafts: ScheduledDraft[] = [];
    const waiting = new Map<string, Set<string>>();
    for (const hood of hoods) {
      const text = dto.message ? fillTemplate(dto.message, hood) : textForHood(item!, hood);
      if (!text || needsLocalDetails(text)) {
        noteWaiting(waiting, item?.code ?? "your text", hood.city);
        continue;
      }
      drafts.push({
        hoodId: String(hood._id),
        source: "compose",
        batchId,
        contentItemId: item ? String(item._id) : undefined,
        code: item?.code,
        message: text,
        category,
        pollOptions,
        pollDays: dto.pollDays ?? item?.pollDays,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        eventLocation: dto.eventLocation ? fillTemplate(dto.eventLocation, hood) : undefined,
        pinDays: dto.pinDays ?? item?.pinDays,
        runAt,
        createdBy: actor.uid,
      });
    }
    const { scheduled, duplicates } = await this.schedule(drafts);
    await this.audit.record(actor, "hood_content_compose", { type: "hood_content_batch", id: batchId, label: `${item?.code ?? "Post"} → ${scheduled} Hood${scheduled === 1 ? "" : "s"}` });
    return { batchId, hoods: hoods.length, scheduled, alreadyScheduled: duplicates, needsLocalDetails: waitingList(waiting) };
  }

  /**
   * POST /admin/hood-content/activation: a new Hood's first ten days (DEFAULT_ACTIVATION_PLAN), from
   * `startDate`, for each chosen Hood that isn't already active. Applying it again adds nothing twice.
   */
  async applyActivation(actor: Viewer, dto: ActivationDto): Promise<ScheduleResult> {
    const hoods = await this.resolveHoods(dto);
    const threshold = dto.skipIfPostsAtLeast ?? 15;
    const counts = await this.postCounts(hoods.map((h) => String(h._id)));
    const quiet = hoods.filter((h) => (counts.get(String(h._id)) ?? 0) < threshold);
    const codes = [...new Set(DEFAULT_ACTIVATION_PLAN.map((s) => s.code))];
    const bank = new Map((await this.items.find({ code: { $in: codes }, active: true }).lean<(ContentItem & { _id: Types.ObjectId })[]>().exec()).map((i) => [i.code, i]));
    const start = dto.startDate ?? watDate(new Date());
    if (start < watDate(new Date())) throw new BadRequestException("The plan can't start in the past.");

    const batchId = randomUUID();
    const now = Date.now();
    const drafts: ScheduledDraft[] = [];
    const waiting = new Map<string, Set<string>>();
    for (const hood of quiet) {
      for (const step of DEFAULT_ACTIVATION_PLAN) {
        const item = bank.get(step.code);
        if (!item) continue;
        const text = textForHood(item, hood);
        if (!text) {
          noteWaiting(waiting, item.code, hood.city);
          continue;
        }
        // A step whose time has already passed today goes out now (the queue posts them one at a time).
        const at = atWat(addDays(start, step.day), step.time).getTime();
        drafts.push({
          hoodId: String(hood._id),
          source: "activation",
          batchId,
          contentItemId: String(item._id),
          code: item.code,
          message: text,
          category: item.category,
          pollOptions: item.pollOptions,
          pollDays: item.pollDays,
          pinDays: item.pinDays,
          runAt: new Date(Math.max(at, now)),
          createdBy: actor.uid,
          dedupeKey: `activation:${String(hood._id)}:${item.code}`,
        });
      }
    }
    const { scheduled, duplicates } = await this.schedule(drafts);
    await this.audit.record(actor, "hood_content_activation", { type: "hood_content_batch", id: batchId, label: `Activation plan → ${quiet.length} Hood${quiet.length === 1 ? "" : "s"}` });
    return { batchId, hoods: quiet.length, activeHoods: hoods.length - quiet.length, scheduled, alreadyScheduled: duplicates, needsLocalDetails: waitingList(waiting) };
  }

  async listScheduled(q: ScheduledListQuery) {
    const rows = await this.scheduled
      .find({ ...(q.status && { status: q.status }), ...(q.source && { source: q.source }), ...(q.hoodId && { hoodId: q.hoodId }), ...(q.batchId && { batchId: q.batchId }) })
      .sort(q.status === "scheduled" ? { runAt: 1 } : { runAt: -1 })
      .limit(q.limit ?? 100)
      .lean<(ScheduledPost & { _id: Types.ObjectId })[]>()
      .exec();
    const names = await this.hoodNames(rows.map((r) => r.hoodId));
    return rows.map((r) => ({
      _id: String(r._id),
      hoodId: r.hoodId,
      hoodName: names.get(r.hoodId) ?? "Unknown Hood",
      source: r.source,
      batchId: r.batchId,
      code: r.code ?? null,
      message: r.message,
      category: r.category,
      pinDays: r.pinDays ?? null,
      runAt: r.runAt.toISOString(),
      status: r.status,
      postId: r.postId ?? null,
      problem: r.problem ?? null,
    }));
  }

  async cancel(actor: Viewer, id: string) {
    const r = await this.scheduled.findOneAndUpdate({ _id: id, status: "scheduled" }, { $set: { status: "cancelled" } }).lean<ScheduledPost>().exec();
    if (!r) throw new BadRequestException("Only posts that haven't gone out yet can be cancelled.");
    await this.audit.record(actor, "hood_content_cancel", { type: "hood_content_scheduled", id, label: r.code ?? r.message.slice(0, 60) });
  }

  async cancelBatch(actor: Viewer, batchId: string) {
    const { modifiedCount } = await this.scheduled.updateMany({ batchId, status: "scheduled" }, { $set: { status: "cancelled" } }).exec();
    await this.audit.record(actor, "hood_content_cancel", { type: "hood_content_batch", id: batchId, label: `${modifiedCount} cancelled` });
    return { cancelled: modifiedCount };
  }

  async pin(actor: Viewer, postId: string, days: number) {
    await this.postsService.setPinned(postId, days > 0 ? new Date(Date.now() + days * DAY_MS) : null);
    await this.audit.record(actor, days > 0 ? "post_pin" : "post_unpin", { type: "post", id: postId, label: days > 0 ? `Pinned for ${days} day${days === 1 ? "" : "s"}` : "Unpinned" });
  }

  /**
   * The job: post one scheduled item. Does nothing unless it is still "scheduled" (cancelled, already
   * done). The post's clientId makes a retried run return the post the first run made.
   */
  async publish(id: string): Promise<void> {
    const s = await this.scheduled.findById(id).lean<ScheduledPost & { _id: Types.ObjectId }>().exec();
    if (!s || s.status !== "scheduled") return;
    const hood = await this.hoods.findById(s.hoodId).select({ status: 1 }).lean<HoodRow>().exec();
    if (!hood || hood.status !== "active") {
      await this.scheduled.updateOne({ _id: s._id, status: "scheduled" }, { $set: { status: "skipped", problem: "The Hood isn't open." } }).exec();
      return;
    }
    const now = Date.now();
    const dto: CreatePostDto = {
      clientId: `hc-${String(s._id)}`,
      message: s.message,
      category: postedCategory(s.category, Boolean(s.eventDate)),
      visibility: "anyone",
      ...(s.category === "poll" &&
        s.pollOptions && { poll: { options: s.pollOptions.map((text, i) => ({ id: `o${i + 1}`, text })), closesAt: new Date(now + (s.pollDays ?? 5) * DAY_MS).toISOString() } }),
      ...(s.eventDate && { eventDate: s.eventDate.toISOString(), eventLocation: s.eventLocation }),
    } as CreatePostDto;
    try {
      const post = await this.postsService.createAsTeam(s.hoodId, dto, { pinnedUntil: s.pinDays ? new Date(now + s.pinDays * DAY_MS) : null, contentItemId: s.contentItemId });
      await this.scheduled.updateOne({ _id: s._id }, { $set: { status: "published", postId: post._id, publishedAt: new Date() } }).exec();
      if (s.contentItemId) await this.items.updateOne({ _id: s.contentItemId }, { $inc: { timesUsed: 1 } }).exec();
    } catch (err) {
      // The post itself was refused (an event now in the past, text the filter blocks): retrying won't help.
      if (err instanceof HttpException && err.getStatus() < 500) {
        await this.scheduled.updateOne({ _id: s._id }, { $set: { status: "failed", problem: err.message } }).exec();
        return;
      }
      throw err;
    }
  }

  // ── Daily prompt ─────────────────────────────────────────────────────────

  async dailySettings(): Promise<{ daily: DailySettings; dailyDoneFor: string | null; upcoming: { date: string; code: string | null; chosen: boolean; text: string | null }[] }> {
    const s = await this.settings();
    const daily = { ...DEFAULT_DAILY, ...s.daily };
    const dailyCodes = await this.dailyCodes();
    const today = watDate(new Date());
    const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    const codes = dates.map((d) => daily.calendar[d] ?? rotationPick(dailyCodes, d));
    const bodies = new Map((await this.items.find({ code: { $in: codes.filter(Boolean) } }).select({ code: 1, body: 1 }).lean<Pick<ContentItem, "code" | "body">[]>().exec()).map((i) => [i.code, i.body]));
    return {
      daily,
      dailyDoneFor: s.dailyDoneFor ?? null,
      upcoming: dates.map((date, i) => ({ date, code: codes[i] ?? null, chosen: Boolean(daily.calendar[date]), text: codes[i] ? (bodies.get(codes[i]!) ?? null) : null })),
    };
  }

  async updateDaily(actor: Viewer, dto: DailySettingsDto) {
    const s = await this.settings();
    const daily = { ...DEFAULT_DAILY, ...s.daily, ...dto };
    await this.settingsModel.updateOne({ key: SETTINGS_KEY }, { $set: { daily } }).exec();
    await this.audit.record(actor, "hood_content_daily", { type: "settings", id: SETTINGS_KEY, label: daily.enabled ? `Daily prompt on, ${daily.hour}:00` : "Daily prompt off" });
    return this.dailySettings();
  }

  async setCalendarDay(actor: Viewer, date: string, code: string | null) {
    if (date < watDate(new Date())) throw new BadRequestException("That day has passed.");
    if (code && !(await this.items.exists({ code, active: true }))) throw new BadRequestException(`${code} isn't an active item.`);
    await this.settings();
    await this.settingsModel.updateOne({ key: SETTINGS_KEY }, code ? { $set: { [`daily.calendar.${date}`]: code } } : { $unset: { [`daily.calendar.${date}`]: 1 } }).exec();
    await this.audit.record(actor, "hood_content_daily", { type: "settings", id: SETTINGS_KEY, label: `${date}: ${code ?? "rotation"}` });
    return this.dailySettings();
  }

  /**
   * Every five minutes: once it's past the daily hour in Lagos, the day is claimed (one instance,
   * once a day) and today's prompt is scheduled in every open Hood, except Hoods still in their
   * activation plan today. Public so tests and ops can run it.
   */
  async dailyTick(now = new Date()): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    try {
      const s = await this.settings();
      const daily = { ...DEFAULT_DAILY, ...s.daily };
      const today = watDate(now);
      if (!daily.enabled || watHour(now) < daily.hour || s.dailyDoneFor === today) return 0;
      const claimed = await this.settingsModel.findOneAndUpdate({ key: SETTINGS_KEY, dailyDoneFor: { $ne: today } }, { $set: { dailyDoneFor: today } }).exec();
      if (!claimed) return 0;

      const code = daily.calendar[today] ?? rotationPick(await this.dailyCodes(), today);
      const item = code ? await this.items.findOne({ code, active: true }).lean<ContentItem & { _id: Types.ObjectId }>().exec() : null;
      if (!item) {
        this.logger.warn(`No daily prompt for ${today}: ${code ?? "the bank has no daily items"}`);
        return 0;
      }
      let hoods = await this.hoods.find({ status: "active" }).select({ name: 1, city: 1, status: 1 }).lean<HoodRow[]>().exec();
      if (daily.minNeighbours > 0) {
        const neighbours = await this.neighbourCounts(hoods.map((h) => String(h._id)));
        hoods = hoods.filter((h) => (neighbours.get(String(h._id)) ?? 0) >= daily.minNeighbours);
      }
      const inActivation = new Set(
        await this.scheduled.distinct("hoodId", { source: "activation", status: { $in: ["scheduled", "published"] }, runAt: { $gte: atWat(today, "00:00"), $lt: atWat(addDays(today, 1), "00:00") } }).exec(),
      );
      const batchId = `daily-${today}`;
      const drafts = hoods.flatMap((hood): ScheduledDraft[] => {
        const text = inActivation.has(String(hood._id)) ? null : textForHood(item, hood);
        if (!text) return [];
        return [
          {
            hoodId: String(hood._id),
            source: "daily",
            batchId,
            contentItemId: String(item._id),
            code: item.code,
            message: text,
            category: item.category,
            pollOptions: item.pollOptions,
            pollDays: item.pollDays,
            runAt: now,
            createdBy: "system",
            dedupeKey: `daily:${today}:${String(hood._id)}`,
          },
        ];
      });
      const { scheduled } = await this.schedule(drafts);
      this.logger.log(`Daily prompt ${item.code} scheduled in ${scheduled} Hood${scheduled === 1 ? "" : "s"}`);
      return scheduled;
    } finally {
      this.ticking = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Records the drafts (skipping ones already there by dedupeKey) and queues a publish job for each. */
  private async schedule(drafts: ScheduledDraft[]): Promise<{ scheduled: number; duplicates: number }> {
    if (!drafts.length) return { scheduled: 0, duplicates: 0 };
    let inserted: ScheduledPostDocument[] = [];
    try {
      inserted = await this.scheduled.insertMany(drafts.map((d) => ({ ...d, status: "scheduled" })), { ordered: false });
    } catch (err) {
      const e = err as { code?: number; writeErrors?: unknown[]; insertedDocs?: ScheduledPostDocument[] };
      const allDuplicates = (e.writeErrors ?? []).every((w) => (w as { code?: number; err?: { code?: number } }).code === 11000 || (w as { err?: { code?: number } }).err?.code === 11000);
      if (!(e.code === 11000 || allDuplicates)) throw err;
      inserted = e.insertedDocs ?? [];
    }
    for (const doc of inserted) {
      await this.jobs.enqueue(PUBLISH_JOB, { id: String(doc._id) }, { runAt: doc.runAt, dedupeKey: `${PUBLISH_JOB}:${String(doc._id)}` });
    }
    return { scheduled: inserted.length, duplicates: drafts.length - inserted.length };
  }

  private async resolveHoods(t: HoodTargetDto): Promise<(HoodRow & HoodDetails)[]> {
    const select = { name: 1, city: 1, status: 1 };
    let rows: HoodRow[];
    if (t.allHoods) rows = await this.hoods.find({ status: "active" }).select(select).lean<HoodRow[]>().exec();
    else if (t.hoodIds?.length) rows = await this.hoods.find({ _id: { $in: t.hoodIds }, status: "active" }).select(select).lean<HoodRow[]>().exec();
    else if (t.cities?.length) rows = await this.hoods.find({ status: "active", city: { $in: t.cities.map((c) => new RegExp(`^${c.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) } }).select(select).lean<HoodRow[]>().exec();
    else throw new BadRequestException("Choose the Hoods: some Hoods, some cities, or all Hoods.");
    if (!rows.length) throw new BadRequestException("None of those Hoods is open.");
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async postCounts(hoodIds: string[]): Promise<Map<string, number>> {
    const rows = await this.posts.aggregate<{ _id: string; n: number }>([{ $match: { neighborhoodId: { $in: hoodIds }, isActive: true, removedAt: null } }, { $group: { _id: "$neighborhoodId", n: { $sum: 1 } } }]);
    return new Map(rows.map((r) => [r._id, r.n]));
  }

  private async neighbourCounts(hoodIds: string[]): Promise<Map<string, number>> {
    const rows = await this.users.aggregate<{ _id: string; n: number }>([
      { $match: { neighborhoodId: { $in: hoodIds }, verificationStatus: "verified", deactivatedAt: null } },
      { $group: { _id: "$neighborhoodId", n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.n]));
  }

  private async hoodNames(ids: string[]): Promise<Map<string, string>> {
    const valid = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    const rows = await this.hoods.find({ _id: { $in: valid } }).select({ name: 1 }).lean<HoodRow[]>().exec();
    return new Map(rows.map((r) => [String(r._id), r.name]));
  }

  private async dailyCodes(): Promise<string[]> {
    return (await this.items.find({ tag: "daily", active: true }).select({ code: 1 }).lean<{ code: string }[]>().exec()).map((r) => r.code);
  }

  private async settings(): Promise<HoodContentSettings> {
    return (await this.settingsModel.findOneAndUpdate({ key: SETTINGS_KEY }, { $setOnInsert: { key: SETTINGS_KEY, daily: { ...DEFAULT_DAILY, calendar: {} } } }, { upsert: true, returnDocument: "after" }).lean<HoodContentSettings>().exec())!;
  }

  private checkItem(category: TeamCategory, pollOptions?: string[]) {
    if (category === "poll") {
      const problem = pollProblem(pollOptions);
      if (problem) throw new BadRequestException(problem);
    }
  }
}

function itemView(i: ContentItem & { _id: unknown }) {
  return {
    _id: String(i._id),
    code: i.code,
    tag: i.tag,
    category: i.category,
    body: i.body,
    pollOptions: i.pollOptions ?? null,
    pollDays: i.pollDays ?? null,
    pinDays: i.pinDays ?? null,
    cityVariants: i.cityVariants ?? [],
    needsLocalDetails: needsLocalDetails(i.body),
    active: i.active,
    timesUsed: i.timesUsed ?? 0,
    updatedAt: (i.updatedAt ?? new Date()).toISOString(),
  };
}

function noteWaiting(waiting: Map<string, Set<string>>, code: string, city: string | undefined) {
  const set = waiting.get(code) ?? new Set<string>();
  set.add(city?.trim() || "No city");
  waiting.set(code, set);
}

function waitingList(waiting: Map<string, Set<string>>) {
  return [...waiting].map(([code, cities]) => ({ code, cities: [...cities].sort() }));
}
