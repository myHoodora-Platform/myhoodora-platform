import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Model, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { Neighborhood, NeighborhoodDocument } from "../hoods/schemas/hood.schema";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { User, UserDocument } from "../users/schemas/user.schema";

export type Audience = { type: "all" } | { type: "hood"; hoodIds: string[] } | { type: "user"; uids: string[] };
export type BroadcastStatus = "sending" | "sent" | "failed";

/** Notifications written per database round trip. */
const BATCH_SIZE = 1_000;
/** The same message to the same audience from the same person within this window is a double-click, not a second broadcast. */
const DUPLICATE_WINDOW_MS = 5 * 60_000;
/** A broadcast still "sending" after this long was interrupted (deploy, crash) and is picked up again at startup. */
const STALLED_AFTER_MS = 2 * 60_000;

@Schema({ timestamps: { createdAt: "sentAt", updatedAt: false }, collection: "broadcasts" })
export class Broadcast {
  @Prop({ required: true, maxlength: 60 }) title!: string;
  @Prop({ required: true, maxlength: 240 }) body!: string;
  @Prop({ type: Object, required: true }) audience!: Audience;
  @Prop({ required: true }) audienceLabel!: string;
  /** How many people it was addressed to when it was sent. */
  @Prop({ required: true }) reach!: number;
  @Prop({ required: true }) sentBy!: string;
  @Prop({ required: true }) sentByUid!: string;
  /** Rows written before this field existed were delivered inside the request: "sent". */
  @Prop({ enum: ["sending", "sent", "failed"], default: "sent" }) status!: BroadcastStatus;
  /** Notifications written so far. */
  @Prop({ default: 0 }) delivered!: number;
  @Prop({ type: Date }) completedAt?: Date;
  sentAt?: Date;
}
export const BroadcastSchema = SchemaFactory.createForClass(Broadcast);
BroadcastSchema.index({ status: 1, sentAt: 1 });

/**
 * Platform announcements to neighbours' notifications (contract §13.8).
 *
 * The request only records the broadcast and answers; delivery runs afterwards in batches, so a
 * message to every neighbour doesn't hold a request open (or time out). No queue: each notification
 * carries a unique key per broadcast and person, so delivery can simply be run again after a
 * restart and nobody is notified twice.
 */
@Injectable()
export class BroadcastsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    @InjectModel(Broadcast.name) private readonly broadcasts: Model<Broadcast>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Finish anything a restart interrupted. */
  onApplicationBootstrap() {
    void this.resumeStalled().catch((err) => this.logger.error("Couldn't resume interrupted broadcasts", err instanceof Error ? err.stack : String(err)));
  }

  private recipientFilter(a: Audience): QueryFilter<User> {
    const base: QueryFilter<User> = { deactivatedAt: null, accountStatus: { $ne: "suspended" as const } };
    if (a.type === "all") return { ...base, verificationStatus: "verified" as const };
    if (a.type === "hood") return { ...base, neighborhoodId: { $in: a.hoodIds } };
    return { ...base, uid: { $in: a.uids } };
  }

  estimate(a: Audience): Promise<number> {
    return this.users.countDocuments(this.recipientFilter(a)).exec();
  }

  async list() {
    const rows = await this.broadcasts.find().sort({ sentAt: -1 }).limit(100).lean<(Broadcast & { _id: unknown })[]>().exec();
    return rows.map((b) => ({
      id: String(b._id),
      title: b.title,
      body: b.body,
      audience: b.audience,
      audienceLabel: b.audienceLabel,
      reach: b.reach,
      sentAt: b.sentAt?.toISOString(),
      sentBy: b.sentBy,
      status: b.status ?? "sent",
      delivered: b.status ? b.delivered : b.reach,
    }));
  }

  /** "Ada Obi", "Ada Obi, Tunde Bello" … "Ada Obi, Tunde Bello, Kemi Ade and 4 more". */
  private async peopleLabel(uids: string[]): Promise<string> {
    const shown = 3;
    const names = (await this.users.find({ uid: { $in: uids.slice(0, shown) } }).select({ displayName: 1 }).lean<Pick<User, "displayName">[]>().exec()).map(
      (u) => u.displayName ?? "Neighbour",
    );
    const more = uids.length - names.length;
    return more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", ");
  }

  async send(actor: Viewer, input: { title: string; body: string; audience: Audience }) {
    if (input.audience.type === "all" && actor.role === "moderator") throw new ForbiddenException("Only admins can message everyone.");
    const ids = input.audience.type === "hood" ? input.audience.hoodIds : input.audience.type === "user" ? input.audience.uids : ["all"];
    if (!ids.length) throw new BadRequestException("Choose who should receive this.");

    const repeat = await this.broadcasts
      .findOne({ sentByUid: actor.uid, title: input.title, body: input.body, audience: input.audience, sentAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (repeat) throw new ConflictException("You sent this exact message a moment ago. It's already on its way.");

    const reach = await this.estimate(input.audience);
    const label =
      input.audience.type === "all"
        ? "Everyone"
        : input.audience.type === "hood"
          ? (await this.hoods.find({ _id: { $in: input.audience.hoodIds } }).select({ name: 1 }).lean<{ name: string }[]>().exec()).map((h) => h.name).join(", ")
          : await this.peopleLabel(input.audience.uids);
    const doc = await this.broadcasts.create({ ...input, audienceLabel: label, reach, sentBy: actor.displayName ?? "Staff", sentByUid: actor.uid, status: "sending", delivered: 0 });
    await this.audit.record(actor, "broadcast_send", { type: "broadcast", id: String(doc._id), label: input.title }, { reason: label });

    // Deliver after answering. Errors are recorded on the broadcast, never thrown into the void.
    void this.deliver(String(doc._id));
    return { id: String(doc._id), estimatedReach: reach, status: "sending" as BroadcastStatus };
  }

  /**
   * Write the notifications in batches, walking recipients by uid so memory stays flat however
   * many there are. Safe to call again for the same broadcast: existing rows are skipped.
   */
  async deliver(id: string): Promise<void> {
    const broadcast = await this.broadcasts.findById(id).lean<Broadcast & { _id: unknown }>().exec();
    if (!broadcast || broadcast.status === "sent") return;
    try {
      const filter = this.recipientFilter(broadcast.audience);
      let after = "";
      for (;;) {
        const batch = await this.users
          .find({ ...filter, uid: { ...(filter.uid as object | undefined), $gt: after } })
          .sort({ uid: 1 })
          .limit(BATCH_SIZE)
          .select({ uid: 1 })
          .lean<Pick<User, "uid">[]>()
          .exec();
        if (!batch.length) break;
        const uids = batch.map((u) => u.uid);
        const written = await this.notifications.notifyBulk({
          uids,
          type: "system",
          title: broadcast.title,
          body: broadcast.body,
          href: "/notifications",
          dedupeKey: (uid) => `broadcast:${id}:${uid}`,
        });
        await this.broadcasts.updateOne({ _id: id }, { $inc: { delivered: written } }).exec();
        after = uids[uids.length - 1]!;
        if (batch.length < BATCH_SIZE) break;
      }
      await this.broadcasts.updateOne({ _id: id }, { $set: { status: "sent", completedAt: new Date() } }).exec();
    } catch (err) {
      // Staff see "failed" with how far it got; the cause stays in the server log.
      this.logger.error(`Broadcast ${id} failed part-way`, err instanceof Error ? err.stack : String(err));
      await this.broadcasts.updateOne({ _id: id }, { $set: { status: "failed", completedAt: new Date() } }).exec().catch(() => undefined);
    }
  }

  /** Staff retry of a failed broadcast. People who already have it are skipped. */
  async retry(actor: Viewer, id: string) {
    const claimed = await this.broadcasts.findOneAndUpdate({ _id: id, status: "failed" }, { $set: { status: "sending" }, $unset: { completedAt: "" } }).lean<Broadcast>().exec();
    if (!claimed) {
      if (!(await this.broadcasts.exists({ _id: id }))) throw new NotFoundException("Broadcast not found.");
      throw new ConflictException("Only a failed broadcast can be retried.");
    }
    await this.audit.record(actor, "broadcast_send", { type: "broadcast", id, label: claimed.title }, { reason: "Retry" });
    void this.deliver(id);
    return { id, status: "sending" as BroadcastStatus };
  }

  /** Broadcasts left "sending" by a restart: carry on where they stopped. */
  async resumeStalled(): Promise<number> {
    const stalled = await this.broadcasts
      .find({ status: "sending", sentAt: { $lt: new Date(Date.now() - STALLED_AFTER_MS) } })
      .select({ _id: 1 })
      .lean<{ _id: unknown }[]>()
      .exec();
    for (const b of stalled) await this.deliver(String(b._id));
    return stalled.length;
  }
}
