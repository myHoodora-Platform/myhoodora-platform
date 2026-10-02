import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, type Types } from "mongoose";
import { messageEmail } from "../communications/templates/email-templates";
import type { NotificationKind } from "../notifications/notification.schema";
import { NotificationsService, type NotifyInput } from "../notifications/notifications.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { dueHostNotice, dueReminder, eventEndsAt, type ReminderKind } from "./domain/event-time";
import { decodePostContent } from "./domain/post-meta";
import { FeedPost, Rsvp, type PostDocument } from "./schemas/post.schema";

const TICK_MS = 5 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

type EventRow = Pick<FeedPost, "authorUid" | "neighborhoodId" | "message" | "content" | "eventLocation" | "hostNotices"> & { _id: Types.ObjectId; eventDate: Date };
type RsvpRow = Pick<Rsvp, "uid" | "status" | "remindersSent" | "updatedAt"> & { _id: Types.ObjectId };

/** "Sat 4 Oct, 4:00 pm" in Nigerian time, whatever the server's clock zone. */
const whenLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);

/** The event's name: its first sentence, kept short (the same idea as the web event card). */
function eventTitle(e: Pick<EventRow, "message" | "content">): string {
  const text = (e.message ?? decodePostContent(e.content ?? "", "event").message).trim();
  // First sentence, without its closing punctuation, so it reads inside a sentence ("Road 12 clean-up is tomorrow").
  const first = (text.split(/(?<=[.!?])\s|\n/)[0] ?? text).replace(/[.!?]+$/, "").trim();
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first || "your event";
}

/**
 * Event reminders and follow-ups (contract §23). Every 5 minutes, finds
 * events within the reminder windows and sends what's due. Each reminder is
 * *claimed* with an atomic `$addToSet` on the RSVP (or the post, for the
 * host) before sending, so it goes out exactly once even with several API
 * instances or overlapping ticks. Missed windows (API down) are skipped,
 * never sent late out of order.
 */
@Injectable()
export class EventRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventRemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(FeedPost.name) private readonly posts: Model<PostDocument>,
    @InjectModel(Rsvp.name) private readonly rsvps: Model<Rsvp>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.get<boolean>("eventReminders.enabled")) return;
    const run = () => void this.tick().catch((err) => this.logger.warn(`Event reminder run failed: ${(err as Error).message}`));
    run();
    this.timer = setInterval(run, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** One pass. Public so tests and ops scripts can run it on demand. */
  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0; // a slow pass is still going; the next tick catches up
    this.running = true;
    try {
      const events = await this.posts
        .find({
          category: "event",
          isActive: true,
          removedAt: null,
          // From events that ended up to 48 h ago (follow-ups) to those starting within 48 h.
          eventDate: { $gte: new Date(now.getTime() - 52 * HOUR), $lte: new Date(now.getTime() + 48 * HOUR) },
        })
        .select({ authorUid: 1, neighborhoodId: 1, message: 1, content: 1, eventDate: 1, eventLocation: 1, hostNotices: 1 })
        .lean<EventRow[]>()
        .exec();
      let sent = 0;
      for (const event of events) sent += await this.forEvent(event, now);
      if (sent) this.logger.log(`Sent ${sent} event reminder(s).`);
      return sent;
    } finally {
      this.running = false;
    }
  }

  private async forEvent(event: EventRow, now: Date): Promise<number> {
    let sent = 0;
    const postId = String(event._id);
    const title = eventTitle(event);
    const rsvps = await this.rsvps
      .find({ postId, uid: { $ne: event.authorUid } })
      .select({ uid: 1, status: 1, remindersSent: 1, updatedAt: 1 })
      .lean<RsvpRow[]>()
      .exec();

    // Host: a 2-day heads-up with numbers, then the next-morning recap prompt.
    const hostKind = dueHostNotice(event.eventDate, event.hostNotices, now);
    if (hostKind && (await this.claimHost(event._id, hostKind))) {
      const going = rsvps.filter((r) => r.status === "going").length;
      const interested = rsvps.length - going;
      await this.send(
        event,
        [event.authorUid],
        hostKind === "host_2d"
          ? { title: `Your event is in 2 days: ${going} going, ${interested} interested`, body: `${title} · ${whenLabel(event.eventDate)}`, kind: "event_reminder" }
          : { title: `How did ${title} go?`, body: "Share a few photos or a thank-you with your neighbours.", kind: "event_followup" },
        hostKind,
      );
      sent++;
    }

    // Only people still in the event's Hood can see it, so only they are reminded.
    const members = new Set(
      (
        await this.users
          .find({ uid: { $in: rsvps.map((r) => r.uid) }, neighborhoodId: event.neighborhoodId, deactivatedAt: null })
          .select({ uid: 1 })
          .lean<Pick<User, "uid">[]>()
          .exec()
      ).map((u) => u.uid),
    );
    const host = (await this.users.findOne({ uid: event.authorUid }).select({ displayName: 1 }).lean<Pick<User, "displayName">>().exec())?.displayName ?? "the host";

    for (const r of rsvps) {
      const kind = dueReminder(event.eventDate, r, now);
      if (!kind || !members.has(r.uid) || !(await this.claim(r._id, kind))) continue;
      await this.send(event, [r.uid], this.copy(kind, title, event, host), kind);
      sent++;
    }
    return sent;
  }

  private copy(kind: ReminderKind, title: string, event: EventRow, host: string): { title: string; body?: string; kind: NotificationKind } {
    const where = event.eventLocation ? ` · ${event.eventLocation}` : "";
    switch (kind) {
      case "going_2d":
        return { title: `Reminder: ${title} is on ${whenLabel(event.eventDate)}`, body: `You said you're going${where}.`, kind: "event_reminder" };
      case "going_final":
        return { title: `Starting in 3 hours: ${title}`, body: `${whenLabel(event.eventDate)}${where}`, kind: "event_reminder_final" };
      case "interested_1d":
        return { title: `${title} is tomorrow. Still interested?`, body: `Tap Going so ${host} knows to expect you.`, kind: "event_reminder" };
      case "followup":
        return { title: `Hope you enjoyed ${title}`, body: `Say thanks to ${host} or share a photo with your neighbours.`, kind: "event_followup" };
    }
  }

  /** Exactly-once: only the caller whose update adds `kind` sends it. */
  private async claim(rsvpId: Types.ObjectId, kind: ReminderKind): Promise<boolean> {
    const res = await this.rsvps.updateOne({ _id: rsvpId, remindersSent: { $ne: kind } }, { $addToSet: { remindersSent: kind } }, { timestamps: false }).exec();
    return res.modifiedCount === 1;
  }

  private async claimHost(postId: Types.ObjectId, kind: string): Promise<boolean> {
    const res = await this.posts.updateOne({ _id: postId, hostNotices: { $ne: kind } }, { $addToSet: { hostNotices: kind } }, { timestamps: false }).exec();
    return res.modifiedCount === 1;
  }

  private async send(event: EventRow, uids: string[], msg: { title: string; body?: string; kind: NotificationKind }, key: string) {
    const postId = String(event._id);
    const href = `/p/${postId}`;
    const appUrl = this.config.get<string>("appUrl") ?? "";
    const input: NotifyInput = {
      uids,
      type: "event",
      // Reminders about a host's event respect blocks (people who blocked the host aren't nudged).
      actorUid: uids[0] === event.authorUid ? undefined : event.authorUid,
      title: msg.title.slice(0, 140),
      body: msg.body?.slice(0, 280),
      href,
      category: "events",
      kind: msg.kind,
      subjectId: postId,
      email: {
        type: "event_reminder",
        render: (name) =>
          messageEmail({
            subject: msg.title,
            name,
            paragraphs: [msg.body ?? "", `Ends around ${whenLabel(eventEndsAt(event.eventDate))}.`].filter(Boolean),
            cta: { href: `${appUrl}${href}`, label: "View event" },
          }),
        idempotencyKey: (uid) => `event:${postId}:${key}:${uid}`,
      },
    };
    await this.notifications.notify(input);
  }
}
