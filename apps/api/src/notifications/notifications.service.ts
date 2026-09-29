import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CommunicationsService } from "../communications/communications.service";
import type { RenderedEmail } from "../communications/templates/email-templates";
import { User, UserDocument } from "../users/schemas/user.schema";
import type { NotificationCategory } from "../users/domain/preferences";
import { Notification, NotificationDocument, type NotificationType } from "./notification.schema";

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
  /** Optional email, sent only if the recipient's preferences allow it (or `forceEmail`). */
  email?: { type: string; render: (name?: string) => RenderedEmail; idempotencyKey: (uid: string) => string; force?: boolean };
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
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
          await this.notifications.create({ uid: r.uid, type: input.type, actorUid: input.actorUid, title: input.title, body: input.body, href: input.href, groupKey: input.groupKey });
        }
      } else {
        await this.notifications.create({ uid: r.uid, type: input.type, actorUid: input.actorUid, title: input.title, body: input.body, href: input.href });
      }

      const wantsEmail = input.email && (input.email.force || (input.category && r.preferences?.notifications?.[input.category]?.email));
      if (wantsEmail && r.email) {
        await this.comms.sendEmail({ uid: r.uid, to: r.email, type: input.email!.type, email: input.email!.render(r.displayName), idempotencyKey: input.email!.idempotencyKey(r.uid) });
      }
    }
    return recipients.length;
  }

  async list(uid: string, limit = 50): Promise<AppNotification[]> {
    const rows = await this.notifications.find({ uid }).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).lean().exec();
    return rows.map(toApp);
  }

  async markRead(uid: string, id: string): Promise<AppNotification> {
    // Ownership: the filter includes uid, so another user's id is a 404.
    const row = await this.notifications.findOneAndUpdate({ _id: id, uid }, { $set: { readAt: new Date() } }, { new: true }).lean().exec();
    if (!row) throw new NotFoundException("Notification not found.");
    return toApp(row);
  }

  async markAllRead(uid: string): Promise<void> {
    await this.notifications.updateMany({ uid, readAt: null }, { $set: { readAt: new Date() } }).exec();
  }

  async unreadCount(uid: string): Promise<number> {
    return this.notifications.countDocuments({ uid, readAt: null }).exec();
  }
}

function toApp(n: Notification & { _id: unknown }): AppNotification {
  return {
    _id: String(n._id),
    type: n.type,
    actorUid: n.actorUid,
    title: n.title,
    body: n.body,
    href: n.href,
    createdAt: (n.createdAt ?? new Date()).toISOString(),
    read: Boolean(n.readAt),
  };
}
