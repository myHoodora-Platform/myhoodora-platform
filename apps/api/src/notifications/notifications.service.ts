import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CommunicationsService } from "../communications/communications.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { RenderedEmail } from "../communications/templates/email-templates";
import { User, UserDocument } from "../users/schemas/user.schema";
import type { NotificationCategory } from "../users/domain/preferences";
import { Notification, NotificationDocument, type NotificationKind, type NotificationType } from "./notification.schema";

export interface NotifyInput {
  uids: string[];
  type: NotificationType;
  actorUid?: string;
  title: string;
  body?: string;
  href: string;
  /** Preference bucket that gates external channels. Omit for account/safety notices that always go in-app. */
  category?: NotificationCategory;
  /** Same key within an unread window → update the existing row instead of adding another. */
  groupKey?: string;
  /**
   * For work that may run twice (a retried job): a key per recipient that makes the second write a
   * no-op instead of a second notification. Not needed with `groupKey`, which already updates in place.
   */
  dedupeKey?: (uid: string) => string;
  kind?: NotificationKind;
  subjectId?: string;
  /** Optional email, sent only if the recipient's preferences allow it (or `forceEmail`). */
  email?: { type: string; render: (name?: string) => RenderedEmail; idempotencyKey: (uid: string) => string; force?: boolean };
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
  kind?: NotificationKind;
  subjectId?: string;
  actorUid?: string;
  title: string;
  body?: string;
  href: string;
  createdAt: string;
  read: boolean;
}

/** Recipients written per database round trip. */
const WRITE_BATCH = 1_000;
/** The schema's limits. Callers build titles from names and reasons of any length; they are shortened here, never refused. */
const MAX_TITLE = 140;
const MAX_BODY = 280;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * The one entry point for telling someone something happened. Decides who
 * actually gets it (not the actor, not people who blocked the actor,
 * deactivated accounts skipped) and which channels (in-app always, email per
 * preferences). Push/SMS plug in here later.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly comms: CommunicationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async notify(input: NotifyInput): Promise<number> {
    const uids = [...new Set(input.uids)].filter((u) => u && u !== input.actorUid);
    if (!uids.length) return 0;
    const recipients = await this.users
      .find({ uid: { $in: uids }, deactivatedAt: null, ...(input.actorUid ? { blockedUids: { $ne: input.actorUid } } : {}) })
      .select({ uid: 1, email: 1, displayName: 1, preferences: 1 })
      .lean<Pick<User, "uid" | "email" | "displayName" | "preferences">[]>()
      .exec();

    // A notification that reports something already done must not fail on its own wording.
    const title = clip(input.title, MAX_TITLE);
    const body = input.body === undefined ? undefined : clip(input.body, MAX_BODY);
    // One write per batch of recipients, not one (or two) per person: a Hood-wide alert is thousands of them.
    for (let i = 0; i < recipients.length; i += WRITE_BATCH) {
      const batch = recipients.slice(i, i + WRITE_BATCH);
      if (input.groupKey) {
        // Their unread notification for this group is brought up to date; if they have none (or have read it), a new one is added.
        const now = new Date();
        await this.notifications.bulkWrite(
          batch.map((r) => ({
            updateOne: {
              filter: { uid: r.uid, groupKey: input.groupKey, readAt: null },
              update: {
                $set: { title, ...(body !== undefined && { body }), ...(input.actorUid !== undefined && { actorUid: input.actorUid }), createdAt: now },
                $setOnInsert: { type: input.type, href: input.href, ...(input.kind !== undefined && { kind: input.kind }), ...(input.subjectId !== undefined && { subjectId: input.subjectId }) },
              },
              upsert: true,
              // `createdAt` is set above (it is "when this last changed"); Mongoose must not add its own.
              timestamps: false,
            },
          })),
          { ordered: false },
        );
      } else {
        const rows = batch.map((r) => ({ uid: r.uid, type: input.type, kind: input.kind, subjectId: input.subjectId, actorUid: input.actorUid, title, body, href: input.href, ...(input.dedupeKey && { dedupeKey: input.dedupeKey(r.uid) }) }));
        if (input.dedupeKey) await this.insertSkippingDuplicates(rows);
        else await this.notifications.insertMany(rows);
      }
    }

    if (input.email) {
      for (const r of recipients) {
        const wantsEmail = input.email.force || (input.category && r.preferences?.notifications?.[input.category]?.email);
        if (wantsEmail && r.email) {
          await this.comms.sendEmail({ uid: r.uid, to: r.email, type: input.email.type, email: input.email.render(r.displayName), idempotencyKey: input.email.idempotencyKey(r.uid) });
        }
      }
    }
    // Every notification in the app goes through here, so they're all live.
    this.realtime.toUsers(recipients.map((r) => r.uid), "notification.created");
    return recipients.length;
  }

  /**
   * The same in-app notification for many people in one write (broadcasts). No email, no
   * per-person queries. `dedupeKey(uid)` makes it safe to run twice: rows that already exist
   * are skipped, never duplicated. Returns how many were newly written.
   */
  async notifyBulk(input: { uids: string[]; type: NotificationType; title: string; body?: string; href: string; dedupeKey: (uid: string) => string }): Promise<number> {
    if (!input.uids.length) return 0;
    const rows = input.uids.map((uid) => ({ uid, type: input.type, title: input.title, body: input.body, href: input.href, dedupeKey: input.dedupeKey(uid) }));
    const written = await this.insertSkippingDuplicates(rows);
    this.realtime.toUsers(input.uids, "notification.created");
    return written;
  }

  /** Insert rows that carry a `dedupeKey`; ones already there are left alone. Returns how many were new. */
  private async insertSkippingDuplicates(rows: Partial<Notification>[]): Promise<number> {
    try {
      await this.notifications.insertMany(rows, { ordered: false });
      return rows.length;
    } catch (err) {
      // ordered:false keeps going past duplicates; anything else is a real failure.
      const failures = (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors;
      if (!failures?.length || failures.some((f) => (f.code ?? f.err?.code) !== 11000)) throw err;
      return rows.length - failures.length;
    }
  }

  async list(uid: string, limit = 50): Promise<AppNotification[]> {
    const rows = await this.notifications.find({ uid }).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).lean().exec();
    return rows.map(toApp);
  }

  async markRead(uid: string, id: string): Promise<AppNotification> {
    // Ownership: the filter includes uid, so another user's id is a 404.
    const row = await this.notifications.findOneAndUpdate({ _id: id, uid }, { $set: { readAt: new Date() } }, { new: true }).lean().exec();
    if (!row) throw new NotFoundException("Notification not found.");
    this.realtime.toUser(uid, "unread.changed");
    return toApp(row);
  }

  async markAllRead(uid: string): Promise<void> {
    await this.notifications.updateMany({ uid, readAt: null }, { $set: { readAt: new Date() } }).exec();
    this.realtime.toUser(uid, "unread.changed");
  }

  async unreadCount(uid: string): Promise<number> {
    return this.notifications.countDocuments({ uid, readAt: null }).exec();
  }
}

function toApp(n: Notification & { _id: unknown }): AppNotification {
  return {
    _id: String(n._id),
    type: n.type,
    kind: n.kind,
    subjectId: n.subjectId,
    actorUid: n.actorUid,
    title: n.title,
    body: n.body,
    href: n.href,
    createdAt: (n.createdAt ?? new Date()).toISOString(),
    read: Boolean(n.readAt),
  };
}
