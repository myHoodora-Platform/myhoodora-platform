import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NotificationsService } from "../notifications/notifications.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { inReminderWindow, lagosDay, REMINDER_MIN_STREAK } from "./domain/streak";
import { EngagementService } from "./engagement.service";

const TICK_MS = 5 * 60_000;
/** A run's ceiling; anyone left over is picked up by the next tick inside the window. */
const BATCH = 2_000;

/**
 * The 18:00 WAT nudge (plan WP-C): one push, only to people with a streak of 3+ days who haven't posted,
 * replied, voted or RSVP'd today, and only if they kept "Streak reminders" on (Settings → Notifications).
 * Each person is recomputed first (they may have been active since the last refresh) and claimed for the
 * day before sending, so it goes out at most once a day even with several API instances. No pushes
 * after 21:00: someone whose phone was off at 18:00 isn't woken at night.
 */
@Injectable()
export class StreakRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreakRemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly engagement: EngagementService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.get<boolean>("streakReminders.enabled")) return;
    const run = () => void this.tick().catch((err: unknown) => this.logger.warn(`Streak reminder run failed: ${(err as Error).message}`));
    this.timer = setInterval(run, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** One pass. Public so tests and ops can run it at a chosen time. Returns how many were reminded. */
  async tick(now = new Date()): Promise<number> {
    if (this.running || !inReminderWindow(now)) return 0;
    this.running = true;
    try {
      if (!(await this.engagement.settings()).streaksOn) return 0;
      const today = lagosDay(now);
      const candidates = await this.users
        .find({
          "engagement.streak": { $gte: REMINDER_MIN_STREAK },
          "engagement.lastDay": { $ne: today },
          streakRemindedDay: { $ne: today },
          accountStatus: { $ne: "suspended" },
          deactivatedAt: null,
          purgedAt: null,
        })
        .select({ uid: 1 })
        .limit(BATCH)
        .lean<Pick<User, "uid">[]>()
        .exec();
      let sent = 0;
      for (const { uid } of candidates) {
        const view = await this.engagement.refresh(uid, now).catch(() => null);
        const streak = view?.streak;
        if (!streak || streak.activeToday || streak.current < REMINDER_MIN_STREAK) continue;
        // Exactly once a day: only the run whose update sets today sends.
        const claimed = await this.users.updateOne({ uid, streakRemindedDay: { $ne: today } }, { $set: { streakRemindedDay: today } }, { timestamps: false }).exec();
        if (claimed.modifiedCount !== 1) continue;
        await this.notifications.notify({
          uids: [uid],
          type: "system",
          title: `Keep your ${streak.current}-day streak going`,
          body: "A post, a reply, a poll vote or an RSVP before midnight keeps it. Reactions don't count.",
          href: "/news-feed",
          category: "streaks",
          kind: "streak_reminder",
          // One row in the list, updated each day, rather than one per day.
          groupKey: "streak-reminder",
        });
        sent++;
      }
      if (sent) this.logger.log(`Sent ${sent} streak reminder(s).`);
      return sent;
    } finally {
      this.running = false;
    }
  }
}
