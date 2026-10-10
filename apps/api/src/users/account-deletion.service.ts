import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SessionRevocationService } from "../auth/session-revocation.service";
import { getFirebaseAdmin } from "../config/firebase.config";
import { JobsService } from "../jobs/jobs.service";
import { AccountLifecycle, RESTORE_WINDOW_MS } from "./account-lifecycle";
import { DEFAULT_PREFERENCES } from "./domain/preferences";
import { User, type UserDocument } from "./schemas/user.schema";

/** off: nothing runs · dry-run: finds who is due and logs what would go, changes nothing · live: deletes. */
export type DeletionMode = "off" | "dry-run" | "live";

export const ACCOUNT_PURGE = "account.purge";
/** How often each instance looks for accounts that have become due. */
const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Accounts queued per check. More than this wait for the next one. */
const BATCH = 200;

export interface PurgeReport {
  uid: string;
  dryRun: boolean;
  /** What was (or, in a dry run, would be) removed or cut loose, per kind. */
  counts: Record<string, number>;
}

/**
 * Deletes an account for good 30 days after it was deactivated, which is what the privacy policy
 * promises ("we delete or anonymise your personal data").
 *
 * For each account that is due: every module removes what it holds about the person
 * (AccountLifecycle.purge), their Firebase sign-in is deleted, and what is left of their record is
 * emptied of everything personal and marked `purgedAt`. What stays is the bare uid on moderation
 * cases and audit records, so that history still reads correctly, and the other person's copy of
 * any conversation, with the deleted person shown as "Deleted User".
 *
 * This cannot be undone. `DATA_DELETION_MODE` starts at "dry-run", which only logs who is due and
 * how much would go. Turn it to "live" after reading those logs, with a backup taken that day.
 *
 * Each account is one job (JobsService), so a failure part-way is retried and a restart loses
 * nothing. Every step is safe to repeat, and `purgedAt` is written last: an account is never
 * marked deleted while any of it remains.
 */
@Injectable()
export class AccountDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionService.name);
  private readonly mode: DeletionMode;
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly lifecycle: AccountLifecycle,
    private readonly jobs: JobsService,
    private readonly revocations: SessionRevocationService,
    config: ConfigService,
  ) {
    this.mode = config.get<DeletionMode>("deletion.mode") ?? "dry-run";
  }

  onModuleInit() {
    this.jobs.register(ACCOUNT_PURGE, async (payload) => void (await this.purge(String(payload.uid))));
    if (this.mode === "off") return;
    const check = () => void this.enqueueDue().catch((err: unknown) => this.logger.error("Couldn't look for accounts due for deletion", err instanceof Error ? err.stack : String(err)));
    this.timer = setInterval(check, CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Deactivated more than 30 days before `now`, and not yet deleted. */
  private due(now: Date) {
    return { deactivatedAt: { $ne: null, $lte: new Date(now.getTime() - RESTORE_WINDOW_MS) }, purgedAt: null };
  }

  /**
   * Queue a deletion job for every account that is due; returns how many were newly queued.
   * An account already queued is not queued again. (In a dry run its job stays on record for a
   * week, so each due account is logged about once a week, not once an hour.)
   */
  async enqueueDue(now = new Date()): Promise<number> {
    if (this.mode === "off") return 0;
    const due = await this.users.find(this.due(now)).select({ uid: 1 }).sort({ deactivatedAt: 1 }).limit(BATCH).lean<Pick<User, "uid">[]>().exec();
    let queued = 0;
    for (const { uid } of due) {
      // The mode is part of the key: a dry run this week must not stand in for the real thing next week.
      if (await this.jobs.enqueue(ACCOUNT_PURGE, { uid }, { dedupeKey: `${ACCOUNT_PURGE}:${this.mode}:${uid}` })) queued++;
    }
    return queued;
  }

  /**
   * Delete one account, or in a dry run report what deleting it would remove. Null when there is
   * nothing to do: they came back in time, were already deleted, or deletion is switched off.
   */
  async purge(uid: string, now = new Date()): Promise<PurgeReport | null> {
    if (this.mode === "off") return null;
    // Looked up again here, not trusted from the queue: they may have signed back in since.
    const user = await this.users.findOne({ uid, ...this.due(now) }).lean<User>().exec();
    if (!user) return null;
    if (user.role === "owner" && (await this.users.countDocuments({ role: "owner", purgedAt: null }).exec()) <= 1) {
      // Nobody else could ever grant an admin role again. A person has to sort this out.
      this.logger.error(`Account ${uid} is due for deletion but is the only owner: hand the role to someone else first. Nothing was deleted.`);
      return null;
    }

    const dryRun = this.mode !== "live";
    const counts = await this.lifecycle.purge(uid, dryRun);
    if (dryRun) {
      this.logger.log(`[dry run] Account ${uid} (deactivated ${user.deactivatedAt?.toISOString()}) is due for deletion. Would remove: ${JSON.stringify(counts)}. Nothing was changed.`);
      return { uid, dryRun, counts };
    }

    // Nobody keeps a block on someone who no longer exists.
    await this.users.updateMany({ blockedUids: uid }, { $pull: { blockedUids: uid } }).exec();
    // Their sign-in, held by Firebase: email address, password hash, linked Google account.
    await getFirebaseAdmin()
      .auth()
      .deleteUser(uid)
      .catch((err: { code?: string }) => {
        if (err?.code !== "auth/user-not-found") throw err;
      });
    // What this instance remembers about their sessions is out of date now: the next request asks Firebase, which says "no such user".
    this.revocations.forget(uid);
    // Last, so that a failure anywhere above leaves the account "not deleted yet" and the job is retried.
    await this.users
      .updateOne(
        { uid },
        {
          $set: {
            // Not an address: the field is required, and this can never receive mail.
            email: `deleted-${uid}@users.myhoodora.invalid`,
            role: "member",
            verificationStatus: "unverified",
            isOnboarded: false,
            blockedUids: [],
            verificationAttempts: [],
            preferences: structuredClone(DEFAULT_PREFERENCES),
            requestedHood: null,
            deactivation: null,
            emailVerifiedAt: null,
            restrictedUntil: null,
            purgedAt: new Date(),
          },
          $unset: { displayName: 1, photoURL: 1, bio: 1, location: 1, lastKnownLocation: 1, neighborhoodId: 1, lastNeighborhoodId: 1, verifiedAt: 1 },
        },
      )
      .exec();
    this.logger.log(`Account ${uid} deleted, 30 days after it was deactivated. Removed: ${JSON.stringify(counts)}.`);
    return { uid, dryRun, counts };
  }
}
