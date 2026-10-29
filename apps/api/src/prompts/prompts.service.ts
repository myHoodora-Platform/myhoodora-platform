import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import { Neighborhood } from "../hoods/schemas/hood.schema";
import { JobsService } from "../jobs/jobs.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { searchRegex } from "../shared/http/pagination";
import { AccountLifecycle } from "../users/account-lifecycle";
import { User } from "../users/schemas/user.schema";
import { pickPrompt, shouldAskStoreReview, type StoreReviewRules } from "./domain/eligibility";
import { EngagementCounter, Prompt, PROMPT_ACTIONS, PROMPT_FEATURES, PromptExposure, PromptResponse, PromptSettings, type PromptDocument, type PromptStatus, type SignalKey, type TriggerType } from "./prompt.schema";
import type { PromptInputDto, PromptSettingsDto, RespondDto } from "./prompts.dto";

const DAY = 86_400_000;
/** Job: push a manual prompt to its audience, a page at a time (safe to run twice). */
const PROMPT_PUSH = "prompt.push";
const PUSH_PAGE = 1_000;

type PromptRow = Prompt & { _id: Types.ObjectId };

/** What the app needs to show a prompt; never its audience, schedule or results. */
export interface PromptView {
  _id: string;
  kind: Prompt["kind"];
  question: string;
  detail?: string;
  options: Prompt["options"];
  commentMode: Prompt["commentMode"];
  commentLabel?: string;
  thanksMessage: string;
  layout: Prompt["layout"];
  accent: string;
  emoji?: string;
  delaySeconds: number;
  /** Echo back with the answer. */
  contextKey?: string;
  subjectId?: string;
}

export interface PromptSettingsView {
  /** Days between two prompts for one neighbour (prompts sent by hand skip it). */
  cooldownDays: number;
  /** When the app asks for an App Store / Play Store review. */
  storeReview: StoreReviewRules;
}

export interface PromptResults {
  shown: number;
  dismissed: number;
  responses: number;
  /** Responses per neighbour it was shown to, %. */
  responseRate: number;
  /** stars and nps: the mean; thumbs: share of thumbs up (0–1). */
  average: number | null;
  /** value or option id → count. */
  distribution: Record<string, number>;
  nps?: { promoters: number; passives: number; detractors: number; score: number };
  comments: { value: number | null; optionId?: string; comment: string; name: string; hood?: string; at: string }[];
}

const DEFAULT_SETTINGS: PromptSettingsView = {
  cooldownDays: 14,
  storeReview: {
    enabled: true,
    milestones: [
      { key: "post_created", count: 5 },
      { key: "listing_sold", count: 1 },
      { key: "event_rsvp", count: 3 },
    ],
    minDaysSinceJoin: 7,
    // The stores cap prompts themselves; we ask far less often than they allow.
    cooldownDays: 120,
  },
};

/**
 * Feedback prompts (contract §33): admins write a question (stars, thumbs, poll, 0–10, open) with
 * when it shows and to whom; the app reports what neighbours do (`signal`) and shows the prompt this
 * picks; answers come back once each. Also decides when the app asks for a store review.
 */
@Injectable()
export class PromptsService implements OnModuleInit {
  constructor(
    @InjectModel(Prompt.name) private readonly prompts: Model<PromptDocument>,
    @InjectModel(PromptResponse.name) private readonly responses: Model<PromptResponse>,
    @InjectModel(PromptExposure.name) private readonly exposures: Model<PromptExposure>,
    @InjectModel(EngagementCounter.name) private readonly counters: Model<EngagementCounter>,
    @InjectModel(PromptSettings.name) private readonly settingsModel: Model<PromptSettings>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Neighborhood.name) private readonly hoodModel: Model<Neighborhood>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.jobs.register(PROMPT_PUSH, (payload) => this.pushToAudience(String(payload.promptId)));
    // Answers stay (anonymous counts in results); who said what goes with the account.
    this.accounts.register({
      name: "prompts",
      purge: async (uid, dryRun) => {
        if (dryRun) return { promptResponses: await this.responses.countDocuments({ uid }).exec() };
        await Promise.all([this.exposures.deleteMany({ uid }).exec(), this.counters.deleteMany({ uid }).exec()]);
        const res = await this.responses.updateMany({ uid }, { $set: { uid: "deleted" }, $unset: { comment: 1 } }).exec();
        return { promptResponses: res.modifiedCount };
      },
    });
  }

  // ── Neighbours ──────────────────────────────────────────────────────────

  /**
   * Something the neighbour just did (or the app opened): counts it, then says whether to ask for a
   * store review now, or which prompt to show (at most one of the two).
   */
  async signal(viewer: Viewer, key: SignalKey, subjectId?: string): Promise<{ prompt: PromptView | null; storeReview: boolean }> {
    const now = new Date();
    const counter = await this.counters.findOneAndUpdate({ uid: viewer.uid, key }, { $inc: { count: 1 }, $set: { lastAt: now } }, { upsert: true, returnDocument: "after" }).lean<EngagementCounter>().exec();
    const count = counter?.count ?? 1;
    const [user, settings, marks] = await Promise.all([
      this.users.findOne({ uid: viewer.uid }).select({ createdAt: 1, neighborhoodId: 1 }).lean<Pick<User, "createdAt" | "neighborhoodId">>().exec(),
      this.settings(),
      this.counters.find({ uid: viewer.uid, key: { $in: ["prompt_shown", "store_review"] } }).lean<EngagementCounter[]>().exec(),
    ]);
    const joinedAt = user?.createdAt ?? now;
    const lastAskedAt = marks.find((m) => m.key === "store_review")?.lastAt;

    if (shouldAskStoreReview(settings.storeReview, { joinedAt, lastAskedAt }, { key, count }, now)) {
      await this.counters.updateOne({ uid: viewer.uid, key: "store_review" }, { $inc: { count: 1 }, $set: { lastAt: now } }, { upsert: true }).exec();
      return { prompt: null, storeReview: true };
    }

    const triggered: QueryFilter<Prompt> = key === "app_open" ? { triggerType: { $in: ["open", "manual"] as TriggerType[] } } : { triggerType: { $in: ["action", "feature"] as TriggerType[] }, triggerKey: key };
    const rules = await this.prompts.find({ status: "active", deletedAt: null, ...triggered }).lean<PromptRow[]>().exec();
    if (!rules.length) return { prompt: null, storeReview: false };
    const ids = rules.map((r) => String(r._id));
    const hoodId = user?.neighborhoodId ?? viewer.hoodId ?? null;
    const [answered, seen, hood] = await Promise.all([
      this.responses.find({ uid: viewer.uid, promptId: { $in: ids } }).select({ promptId: 1 }).lean<Pick<PromptResponse, "promptId">[]>().exec(),
      this.exposures.find({ uid: viewer.uid, promptId: { $in: ids } }).select({ promptId: 1, shows: 1 }).lean<Pick<PromptExposure, "promptId" | "shows">[]>().exec(),
      hoodId ? this.hoods.findManyByIds([hoodId]).then((m) => m.get(hoodId)) : Promise.resolve(undefined),
    ]);
    const chosen = pickPrompt(
      rules.map((r) => ({ ...r, id: String(r._id), deleted: !!r.deletedAt })),
      { joinedAt, hoodId, city: hood?.city, lastPromptAt: marks.find((m) => m.key === "prompt_shown")?.lastAt, answered: new Set(answered.map((a) => a.promptId)), shows: new Map(seen.map((s) => [s.promptId, s.shows])) },
      { key, count },
      { now, cooldownDays: settings.cooldownDays },
    );
    return { prompt: chosen ? { ...this.toView(chosen), contextKey: key, subjectId } : null, storeReview: false };
  }

  /** For a link to one prompt (a push notification): it must be live, for them, and not answered yet. */
  async forViewer(viewer: Viewer, id: string): Promise<PromptView> {
    const p = await this.find(id);
    const now = new Date();
    const live = p.status === "active" && (!p.startsAt || p.startsAt <= now) && (!p.endsAt || p.endsAt > now) && (p.triggerType !== "manual" || (!!p.sentAt && p.sentAt <= now));
    if (!live) throw new NotFoundException("This question has closed. Thanks all the same!");
    if (await this.responses.exists({ promptId: id, uid: viewer.uid })) throw new ConflictException("You've already answered this. Thank you!");
    return this.toView(p);
  }

  /** The app showed it: counts toward its limit and starts the cooldown. */
  async shown(viewer: Viewer, id: string): Promise<{ ok: true }> {
    await this.find(id);
    const now = new Date();
    await Promise.all([
      this.exposures.updateOne({ promptId: id, uid: viewer.uid }, { $inc: { shows: 1 }, $set: { lastShownAt: now } }, { upsert: true }).exec(),
      this.counters.updateOne({ uid: viewer.uid, key: "prompt_shown" }, { $inc: { count: 1 }, $set: { lastAt: now } }, { upsert: true }).exec(),
    ]);
    return { ok: true };
  }

  async dismiss(viewer: Viewer, id: string): Promise<{ ok: true }> {
    await this.find(id);
    await this.exposures.updateOne({ promptId: id, uid: viewer.uid }, { $inc: { dismissals: 1 } }, { upsert: true }).exec();
    return { ok: true };
  }

  /** One answer per neighbour; checked against the prompt's kind. */
  async respond(viewer: Viewer, id: string, dto: RespondDto): Promise<{ thanks: string }> {
    const p = await this.find(id);
    if (p.status === "draft") throw new NotFoundException("Prompt not found.");
    const comment = dto.comment?.trim() || undefined;
    let value: number | null = null;
    let optionId: string | undefined;
    if (p.kind === "stars") value = this.need(dto.value, 1, 5, "Choose 1 to 5 stars.");
    else if (p.kind === "nps") value = this.need(dto.value, 0, 10, "Choose a number from 0 to 10.");
    else if (p.kind === "thumbs") value = this.need(dto.value, 0, 1, "Choose thumbs up or down.");
    else if (p.kind === "poll") {
      if (!dto.optionId || !p.options.some((o) => o.id === dto.optionId)) throw new BadRequestException("Choose one of the options.");
      optionId = dto.optionId;
    }
    const commentNeeded = p.kind === "open" || p.commentMode === "required";
    if (commentNeeded && !comment) throw new BadRequestException(p.kind === "open" ? "Write your answer first." : "Tell us a little more first.");
    if (p.kind !== "open" && p.commentMode === "off" && comment) throw new BadRequestException("This question doesn't take comments.");
    try {
      await this.responses.create({ promptId: id, uid: viewer.uid, value, optionId, comment, contextKey: dto.contextKey, subjectId: dto.subjectId, hoodId: viewer.hoodId ?? undefined, platform: dto.platform });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new ConflictException("You've already answered this. Thank you!");
      throw err;
    }
    return { thanks: this.thanks(p) };
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  async list(q: { status?: PromptStatus; q?: string }) {
    const filter: QueryFilter<Prompt> = { deletedAt: null, ...(q.status && { status: q.status }) };
    const re = searchRegex(q.q);
    if (re) filter.$or = [{ title: re }, { question: re }];
    const rows = await this.prompts.find(filter).sort({ updatedAt: -1 }).limit(200).lean<PromptRow[]>().exec();
    const ids = rows.map((r) => String(r._id));
    const [answers, shows] = await Promise.all([
      this.responses.aggregate<{ _id: string; n: number }>([{ $match: { promptId: { $in: ids } } }, { $group: { _id: "$promptId", n: { $sum: 1 } } }]),
      this.exposures.aggregate<{ _id: string; n: number }>([{ $match: { promptId: { $in: ids }, shows: { $gt: 0 } } }, { $group: { _id: "$promptId", n: { $sum: 1 } } }]),
    ]);
    const a = new Map(answers.map((x) => [x._id, x.n]));
    const s = new Map(shows.map((x) => [x._id, x.n]));
    return rows.map((r) => ({ ...this.toAdmin(r), responses: a.get(String(r._id)) ?? 0, shown: s.get(String(r._id)) ?? 0 }));
  }

  async get(id: string) {
    return this.toAdmin(await this.find(id));
  }

  async create(viewer: Viewer, input: PromptInputDto) {
    const draft = this.merge({ status: "draft", options: [], hoodIds: [], cities: [], commentMode: "optional", layout: "sheet", accent: "green", triggerCount: 1, delaySeconds: 2, priority: 5, maxShows: 2, push: false } as Partial<Prompt>, input);
    if (!draft.title || !draft.kind || !draft.question || !draft.triggerType) throw new BadRequestException("A prompt needs a name, a kind, a question and when it shows.");
    await this.check(draft);
    const created = await withTransaction(this.connection, async (session) => {
      const [doc] = await this.prompts.create([{ ...draft, createdBy: viewer.uid }], { session });
      await this.audit.record(viewer, "prompt_create", { type: "prompt", id: String(doc!._id), label: draft.title! }, {}, session);
      return doc!;
    });
    return this.get(String(created._id));
  }

  async update(viewer: Viewer, id: string, input: PromptInputDto) {
    const row = await this.find(id);
    // Once people have answered, the question and its choices are fixed: results must mean one thing.
    if ((input.kind || input.question || input.options) && (await this.responses.exists({ promptId: id }))) {
      const changed = (input.kind && input.kind !== row.kind) || (input.question && input.question.trim() !== row.question) || (input.options && JSON.stringify(input.options) !== JSON.stringify(row.options));
      if (changed) throw new ConflictException("People have already answered: the question, its kind and choices can't change now. Duplicate it as a new prompt instead.");
    }
    const next = this.merge(row, input);
    await this.check(next);
    await withTransaction(this.connection, async (session) => {
      await this.prompts.updateOne({ _id: row._id }, { $set: this.editable(next) }, { session }).exec();
      await this.audit.record(viewer, "prompt_update", { type: "prompt", id, label: next.title ?? row.title }, {}, session);
    });
    return this.get(id);
  }

  async setStatus(viewer: Viewer, id: string, status: PromptStatus) {
    const row = await this.find(id);
    if (status === "active" && row.endsAt && row.endsAt <= new Date()) throw new BadRequestException("Its end date has passed: change the dates first.");
    const action = { active: "prompt_activate", paused: "prompt_pause", ended: "prompt_end", draft: "prompt_to_draft" }[status];
    await withTransaction(this.connection, async (session) => {
      await this.prompts.updateOne({ _id: row._id }, { $set: { status } }, { session }).exec();
      await this.audit.record(viewer, action, { type: "prompt", id, label: row.title }, {}, session);
    });
    return this.get(id);
  }

  /**
   * Manual prompts: send now. It goes live and shows the next time each neighbour in the audience
   * opens the app; with `push`, they also get a notification that opens it. Sending twice is refused.
   */
  async send(viewer: Viewer, id: string) {
    const row = await this.find(id);
    if (row.triggerType !== "manual") throw new BadRequestException("Only prompts set to “Send now” are sent by hand.");
    if (row.sentAt) throw new ConflictException("This prompt was already sent.");
    const now = new Date();
    await withTransaction(this.connection, async (session) => {
      await this.prompts.updateOne({ _id: row._id, sentAt: null }, { $set: { status: "active", sentAt: now } }, { session }).exec();
      await this.audit.record(viewer, "prompt_send", { type: "prompt", id, label: row.title }, {}, session);
    });
    if (row.push) await this.jobs.enqueue(PROMPT_PUSH, { promptId: id }, { dedupeKey: `${PROMPT_PUSH}:${id}` });
    return this.get(id);
  }

  async remove(viewer: Viewer, id: string): Promise<void> {
    const row = await this.find(id);
    await withTransaction(this.connection, async (session) => {
      await this.prompts.updateOne({ _id: row._id }, { $set: { deletedAt: new Date(), status: "ended" } }, { session }).exec();
      await this.audit.record(viewer, "prompt_delete", { type: "prompt", id, label: row.title }, {}, session);
    });
  }

  /** Who saw it, who answered, what they said (comments newest first, with their name and Hood: staff only). */
  async results(id: string): Promise<PromptResults> {
    const p = await this.find(id, { includeDeleted: true });
    const [rows, exposure] = await Promise.all([
      this.responses.find({ promptId: id }).sort({ createdAt: -1 }).lean<(PromptResponse & { createdAt: Date })[]>().exec(),
      this.exposures.aggregate<{ shown: number; dismissed: number }>([
        { $match: { promptId: id } },
        { $group: { _id: null, shown: { $sum: { $cond: [{ $gt: ["$shows", 0] }, 1, 0] } }, dismissed: { $sum: { $cond: [{ $gt: ["$dismissals", 0] }, 1, 0] } } } },
      ]),
    ]);
    const shown = Math.max(exposure[0]?.shown ?? 0, rows.length);
    const distribution: Record<string, number> = {};
    for (const r of rows) {
      const k = p.kind === "poll" ? (r.optionId ?? "?") : String(r.value ?? "");
      if (k) distribution[k] = (distribution[k] ?? 0) + 1;
    }
    const values = rows.map((r) => r.value).filter((v): v is number => typeof v === "number");
    const average = values.length && p.kind !== "poll" && p.kind !== "open" ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;
    let nps: PromptResults["nps"];
    if (p.kind === "nps" && values.length) {
      const promoters = values.filter((v) => v >= 9).length;
      const detractors = values.filter((v) => v <= 6).length;
      nps = { promoters, passives: values.length - promoters - detractors, detractors, score: Math.round(((promoters - detractors) / values.length) * 100) };
    }
    const withComments = rows.filter((r) => r.comment).slice(0, 200);
    const people = await this.users.find({ uid: { $in: withComments.map((r) => r.uid) } }).select({ uid: 1, displayName: 1 }).lean<Pick<User, "uid" | "displayName">[]>().exec();
    const names = new Map(people.map((u) => [u.uid, u.displayName]));
    const hoods = await this.hoods.findManyByIds(withComments.map((r) => r.hoodId ?? "").filter(Boolean));
    return {
      shown,
      dismissed: exposure[0]?.dismissed ?? 0,
      responses: rows.length,
      responseRate: shown ? Math.round((rows.length / shown) * 1000) / 10 : 0,
      average,
      distribution,
      nps,
      comments: withComments.map((r) => ({ value: r.value ?? null, optionId: r.optionId, comment: r.comment!, name: names.get(r.uid) ?? "A former neighbour", hood: r.hoodId ? hoods.get(r.hoodId)?.name : undefined, at: r.createdAt.toISOString() })),
    };
  }

  /** Every answer as CSV (one row each), for a spreadsheet. */
  async csv(id: string): Promise<string> {
    const p = await this.find(id, { includeDeleted: true });
    const rows = await this.responses.find({ promptId: id }).sort({ createdAt: 1 }).lean<(PromptResponse & { createdAt: Date })[]>().exec();
    const hoods = await this.hoods.findManyByIds([...new Set(rows.map((r) => r.hoodId ?? "").filter(Boolean))]);
    const label = (o?: string) => p.options.find((x) => x.id === o)?.label ?? "";
    const cell = (v: unknown) => {
      const s = v === undefined || v === null ? "" : String(v);
      // Quote everything, and defuse spreadsheet formulas.
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const lines = [["answered_at", "value", "option", "comment", "neighbourhood", "after", "platform"].map(cell).join(",")];
    for (const r of rows) lines.push([r.createdAt.toISOString(), r.value, label(r.optionId), r.comment, r.hoodId ? hoods.get(r.hoodId)?.name : "", r.contextKey, r.platform].map(cell).join(","));
    return lines.join("\n");
  }

  async settings(): Promise<PromptSettingsView> {
    const d = await this.settingsModel.findOne({ key: "prompts" }).lean<PromptSettings>().exec();
    const base = DEFAULT_SETTINGS.storeReview;
    return {
      cooldownDays: d?.cooldownDays ?? DEFAULT_SETTINGS.cooldownDays,
      storeReview: {
        enabled: d?.storeReviewEnabled ?? base.enabled,
        milestones: d?.storeReviewMilestones ?? base.milestones,
        minDaysSinceJoin: d?.storeReviewMinDaysSinceJoin ?? base.minDaysSinceJoin,
        cooldownDays: d?.storeReviewCooldownDays ?? base.cooldownDays,
      },
    };
  }

  async updateSettings(viewer: Viewer, patch: PromptSettingsDto): Promise<PromptSettingsView> {
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await withTransaction(this.connection, async (session) => {
      await this.settingsModel.updateOne({ key: "prompts" }, { $set: set }, { upsert: true, session }).exec();
      await this.audit.record(viewer, "prompt_settings", { type: "prompt_settings", id: "prompts", label: "Feedback and review settings" }, {}, session);
    });
    return this.settings();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private need(v: number | undefined, min: number, max: number, message: string): number {
    if (v === undefined || !Number.isInteger(v) || v < min || v > max) throw new BadRequestException(message);
    return v;
  }

  private thanks(p: Pick<Prompt, "thanksMessage">): string {
    return p.thanksMessage?.trim() || "Thank you! Your answer helps us make myHoodora better for your neighbourhood.";
  }

  private toView(p: PromptRow | (Prompt & { _id: unknown })): PromptView {
    return {
      _id: String(p._id),
      kind: p.kind,
      question: p.question,
      detail: p.detail,
      options: p.options.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji })),
      commentMode: p.kind === "open" ? "required" : p.commentMode,
      commentLabel: p.commentLabel,
      thanksMessage: this.thanks(p),
      layout: p.layout,
      accent: p.accent,
      emoji: p.emoji,
      delaySeconds: p.delaySeconds,
    };
  }

  private toAdmin(r: PromptRow) {
    return {
      ...r,
      _id: String(r._id),
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
      effectiveStatus: r.status === "ended" || (r.endsAt ? r.endsAt <= new Date() : false) ? "ended" : r.status,
    };
  }

  private async find(id: string, opts: { includeDeleted?: boolean } = {}): Promise<PromptRow> {
    const row = Types.ObjectId.isValid(id) ? await this.prompts.findOne({ _id: id, ...(!opts.includeDeleted && { deletedAt: null }) }).lean<PromptRow>().exec() : null;
    if (!row) throw new NotFoundException("Prompt not found.");
    return row;
  }

  private merge(base: Partial<Prompt>, input: PromptInputDto): Partial<Prompt> {
    const next: Partial<Prompt> = { ...base };
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      if (k === "startsAt" || k === "endsAt") (next as Record<string, unknown>)[k] = v ? new Date(v as string) : null;
      else (next as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
    }
    if (input.cities) next.cities = [...new Set(input.cities.map((c) => c.trim()).filter(Boolean))];
    if (input.hoodIds) next.hoodIds = [...new Set(input.hoodIds)];
    return next;
  }

  private editable(p: Partial<Prompt>): Partial<Prompt> {
    const { title, kind, question, detail, options, commentMode, commentLabel, thanksMessage, layout, accent, emoji, triggerType, triggerKey, triggerCount, delaySeconds, hoodIds, cities, minDaysSinceJoin, maxDaysSinceJoin, startsAt, endsAt, priority, maxShows, push } = p;
    return { title, kind, question, detail, options, commentMode, commentLabel, thanksMessage, layout, accent, emoji, triggerType, triggerKey, triggerCount, delaySeconds, hoodIds, cities, minDaysSinceJoin, maxDaysSinceJoin, startsAt, endsAt, priority, maxShows, push };
  }

  private async check(p: Partial<Prompt>): Promise<void> {
    const problems: string[] = [];
    if (p.kind === "poll") {
      const n = p.options?.length ?? 0;
      if (n < 2 || n > 6) problems.push("A poll needs 2 to 6 choices.");
      if (new Set(p.options?.map((o) => o.id)).size !== n) problems.push("Each choice needs its own id.");
    }
    if ((p.triggerType === "action" || p.triggerType === "feature") && !p.triggerKey) problems.push("Choose which action or feature shows it.");
    if (p.triggerType === "action" && p.triggerKey && !ACTION_KEYS.has(p.triggerKey)) problems.push("That isn't an action.");
    if (p.triggerType === "feature" && p.triggerKey && !FEATURE_KEYS.has(p.triggerKey)) problems.push("That isn't a feature.");
    if (p.startsAt && p.endsAt && p.startsAt >= p.endsAt) problems.push("The end date must be after the start date.");
    if (p.minDaysSinceJoin != null && p.maxDaysSinceJoin != null && p.minDaysSinceJoin > p.maxDaysSinceJoin) problems.push("The joined-days range is the wrong way round.");
    if (p.push && p.triggerType !== "manual") problems.push("Only prompts sent by hand can also send a notification.");
    if (p.hoodIds?.length && (await this.hoods.findManyByIds(p.hoodIds)).size !== p.hoodIds.length) problems.push("One of those neighbourhoods doesn't exist.");
    if (problems.length) throw new BadRequestException(problems.join(" "));
  }

  /** The "prompt.push" job: a notification to every neighbour in a sent prompt's audience. Repeat-safe (one per person). */
  private async pushToAudience(promptId: string): Promise<void> {
    const p = await this.prompts.findById(promptId).lean<PromptRow>().exec();
    if (!p || p.deletedAt || !p.sentAt || !p.push) return;
    const now = new Date();
    const cityHoods = p.cities.length ? (await this.hoodModel.find({ city: { $in: p.cities } }).select({ _id: 1 }).lean<{ _id: Types.ObjectId }[]>().exec()).map((h) => String(h._id)) : [];
    const hoodIds = [...p.hoodIds, ...cityHoods];
    const joined: Record<string, Date> = {};
    if (p.minDaysSinceJoin != null) joined.$lte = new Date(now.getTime() - p.minDaysSinceJoin * DAY);
    if (p.maxDaysSinceJoin != null) joined.$gte = new Date(now.getTime() - p.maxDaysSinceJoin * DAY);
    const filter: QueryFilter<User> = {
      deactivatedAt: null,
      accountStatus: { $ne: "suspended" as const },
      verificationStatus: "verified" as const,
      ...(p.hoodIds.length || p.cities.length ? { neighborhoodId: { $in: hoodIds } } : {}),
      ...(Object.keys(joined).length ? { createdAt: joined } : {}),
    };
    let after = "";
    for (;;) {
      const page = await this.users.find({ ...filter, uid: { $gt: after } }).sort({ uid: 1 }).limit(PUSH_PAGE).select({ uid: 1 }).lean<Pick<User, "uid">[]>().exec();
      if (!page.length) break;
      await this.notifications.notify({
        uids: page.map((u) => u.uid),
        type: "system",
        title: p.question.slice(0, 80),
        body: p.detail || "Tap to answer. It takes a few seconds.",
        href: `/feedback/${promptId}`,
        dedupeKey: (uid) => `prompt:${promptId}:${uid}`,
      });
      after = page[page.length - 1]!.uid;
      if (page.length < PUSH_PAGE) break;
    }
  }
}

const ACTION_KEYS = new Set<string>(PROMPT_ACTIONS);
const FEATURE_KEYS = new Set<string>(PROMPT_FEATURES);
