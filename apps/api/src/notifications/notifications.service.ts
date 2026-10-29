import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CommunicationsService } from "../communications/communications.service";
import { PushService } from "../push/push.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { RenderedEmail } from "../communications/templates/email-templates";
import { AccountLifecycle } from "../users/account-lifecycle";
import { FeedPost, PostDocument } from "../posts/schemas/post.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { DEFAULT_PREFERENCES, type NotificationCategory } from "../users/domain/preferences";
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

export interface NotificationActor {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
  kind?: NotificationKind;
  subjectId?: string;
  actorUid?: string;
  /** The people behind it, most recent first (up to three), from GET /notifications. */
  actors?: NotificationActor[];
  /** How many people in all, when more than one (a grouped row). */
  actorCount?: number;
  /** A picture of what it's about (the post's first photo), when there is one. */
  preview?: { image: string };
  title: string;
  body?: string;
  href: string;
  createdAt: string;
  read: boolean;
}

/** Recipients written per database round trip. */
const WRITE_BATCH = 1_000;
/** People remembered per grouped row (enough to count "and 49 others" without growing without bound). */
const MAX_ACTORS = 50;
/** Faces sent with each notification (the client stacks two or three). */
const ACTORS_SHOWN = 3;
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
 * preferences, push to the mobile app per preferences). SMS would plug in here.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    private readonly comms: CommunicationsService,
    private readonly realtime: RealtimeService,
    private readonly accounts: AccountLifecycle,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    // The notifications addressed to them. Ones they caused for other people are those people's.
    this.accounts.register({
      name: "notifications",
      purge: async (uid, dryRun) => ({ notifications: dryRun ? await this.notifications.countDocuments({ uid }).exec() : (await this.notifications.deleteMany({ uid }).exec()).deletedCount }),
    });
  }

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
        // An update pipeline, so the actor joins the front of `actorUids` without appearing twice. Literal values
        // are wrapped in $literal: a title starting with "$" must not be read as a field path.
        const now = new Date();
        const actor = input.actorUid;
        const keep = (field: string, value: unknown) => (value === undefined ? `$${field}` : { $ifNull: [`$${field}`, { $literal: value }] });
        const stage = {
          title: { $literal: title },
          ...(body !== undefined && { body: { $literal: body } }),
          ...(actor !== undefined && {
            actorUid: { $literal: actor },
            actorUids: { $slice: [{ $concatArrays: [[{ $literal: actor }], { $filter: { input: { $ifNull: ["$actorUids", []] }, cond: { $ne: ["$$this", actor] } } }] }, MAX_ACTORS] },
          }),
          createdAt: now,
          type: keep("type", input.type),
          href: keep("href", input.href),
          ...(input.kind !== undefined && { kind: keep("kind", input.kind) }),
          ...(input.subjectId !== undefined && { subjectId: keep("subjectId", input.subjectId) }),
        };
        await this.notifications.collection.bulkWrite(
          batch.map((r) => ({ updateOne: { filter: { uid: r.uid, groupKey: input.groupKey, readAt: null }, update: [{ $set: stage }], upsert: true } })),
          { ordered: false },
        );
      } else {
        const rows = batch.map((r) => ({ uid: r.uid, type: input.type, kind: input.kind, subjectId: input.subjectId, actorUid: input.actorUid, ...(input.actorUid && { actorUids: [input.actorUid] }), title, body, href: input.href, ...(input.dedupeKey && { dedupeKey: input.dedupeKey(r.uid) }) }));
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
    // Push follows each person's setting for the category (defaults if they never changed it). Notices
    // without a category (account and safety notices) are always pushed, as they are always in-app.
    const pushTo = recipients
      .filter((r) => !input.category || (r.preferences?.notifications?.[input.category]?.push ?? DEFAULT_PREFERENCES.notifications[input.category].push))
      .map((r) => r.uid);
    this.push.deliver(pushTo, { title, body, href: input.href, type: input.type, kind: input.kind, subjectId: input.subjectId });
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
    this.push.deliver(input.uids, { title: input.title, body: input.body, href: input.href, type: input.type });
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

  /**
   * Newest first, each with the people behind it (name and photo, up to three) and a picture of what
   * it's about, so a list can show faces and thumbnails without a request per row: one query for the
   * people and one for the posts, whatever the length.
   */
  async list(uid: string, limit = 50): Promise<AppNotification[]> {
    const rows = await this.notifications.find({ uid }).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).lean().exec();
    const shownActors = (n: Notification) => (n.actorUids?.length ? n.actorUids : n.actorUid ? [n.actorUid] : []).slice(0, ACTORS_SHOWN);
    const actorUids = [...new Set(rows.flatMap(shownActors))];
    const postIds = [...new Set(rows.map((n) => postIdFrom(n.href)).filter((id): id is string => !!id))];
    const [people, posts] = await Promise.all([
      actorUids.length
        ? this.users.find({ uid: { $in: actorUids } }).select({ uid: 1, displayName: 1, photoURL: 1 }).lean<Pick<User, "uid" | "displayName" | "photoURL">[]>().exec()
        : [],
      postIds.length
        ? this.posts.find({ _id: { $in: postIds }, isActive: true, removedAt: null }).select({ mediaUrls: 1 }).lean<{ _id: unknown; mediaUrls?: string[] }[]>().exec()
        : [],
    ]);
    const personBy = new Map(people.map((p) => [p.uid, { uid: p.uid, displayName: p.displayName ?? "A neighbour", ...(p.photoURL && { photoURL: p.photoURL }) }]));
    const imageBy = new Map(posts.map((p) => [String(p._id), p.mediaUrls?.find(isImage)]));
    return rows.map((n) => {
      const actors = shownActors(n).map((a) => personBy.get(a)).filter((a): a is NotificationActor => !!a);
      const actorCount = n.actorUids?.length ?? (n.actorUid ? 1 : 0);
      const postId = postIdFrom(n.href);
      const image = postId ? imageBy.get(postId) : undefined;
      return { ...toApp(n), title: groupedTitle(n.title, actors, actorCount), ...(actors.length && { actors }), ...(actorCount > 1 && { actorCount }), ...(image && { preview: { image } }) };
    });
  }

  async markRead(uid: string, id: string): Promise<AppNotification> {
    // Ownership: the filter includes uid, so another user's id is a 404.
    const row = await this.notifications.findOneAndUpdate({ _id: id, uid }, { $set: { readAt: new Date() } }, { returnDocument: "after" }).lean().exec();
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

/** The post a notification links to (`/p/<id>`), if any. */
function postIdFrom(href: string): string | undefined {
  return /^\/p\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(href)?.[1];
}

/** A photo, not a video: thumbnails are still images. */
function isImage(url: string): boolean {
  return !/\/video\/upload\/|\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

/**
 * A grouped row's title names only the latest person ("Tunde reacted to your post"). With others behind
 * it, it says so: "Tunde and Ada reacted…" or "Tunde and 3 others reacted…". Left alone when the title
 * doesn't start with that person's name (it was worded another way).
 */
export function groupedTitle(title: string, actors: NotificationActor[], actorCount: number): string {
  const latest = actors[0]?.displayName;
  if (actorCount < 2 || !latest || !title.startsWith(`${latest} `)) return title;
  const rest = title.slice(latest.length);
  const others = actorCount === 2 && actors[1] ? actors[1].displayName : `${actorCount - 1} ${actorCount === 2 ? "other" : "others"}`;
  return `${latest} and ${others}${rest}`;
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
