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

    for (const r of recipients) {
      if (input.groupKey) {
        const updated = await this.notifications
          .updateOne(
            { uid: r.uid, groupKey: input.groupKey, readAt: null },
            { $set: { title: input.title, body: input.body, actorUid: input.actorUid, createdAt: new Date() } },
            { timestamps: false },
          )
          .exec();
        if (!updated.matchedCount) {
          await this.notifications.create({ uid: r.uid, type: input.type, kind: input.kind, subjectId: input.subjectId, actorUid: input.actorUid, title: input.title, body: input.body, href: input.href, groupKey: input.groupKey });
        }
      } else {
        await this.notifications.create({ uid: r.uid, type: input.type, kind: input.kind, subjectId: input.subjectId, actorUid: input.actorUid, title: input.title, body: input.body, href: input.href });
      }

      const wantsEmail = input.email && (input.email.force || (input.category && r.preferences?.notifications?.[input.category]?.email));
      if (wantsEmail && r.email) {
        await this.comms.sendEmail({ uid: r.uid, to: r.email, type: input.email!.type, email: input.email!.render(r.displayName), idempotencyKey: input.email!.idempotencyKey(r.uid) });
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
    let written = rows.length;
    try {
      await this.notifications.insertMany(rows, { ordered: false });
    } catch (err) {
      // ordered:false keeps going past duplicates; anything else is a real failure.
      const failures = (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors;
      if (!failures?.length || failures.some((f) => (f.code ?? f.err?.code) !== 11000)) throw err;
      written -= failures.length;
    }
    this.realtime.toUsers(input.uids, "notification.created");
    return written;
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
