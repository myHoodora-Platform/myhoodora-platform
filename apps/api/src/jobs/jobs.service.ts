import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Job, type JobDocument } from "./job.schema";

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export interface EnqueueOptions {
  /** A second job with the same key is never added (while the first is queued, running, or finished within the last week). */
  dedupeKey?: string;
  /** Not before this moment. Default: now. */
  runAt?: Date;
  /** Default 5. */
  maxAttempts?: number;
}

/** How often each instance looks for work nobody on it was told about (retries, other instances' jobs, takeovers). */
const POLL_MS = 15_000;
/** How long a claim lasts. A job still "running" after this belongs to a worker that died, and is taken over. */
const LEASE_MS = 10 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
/** Wait before retrying: 30 s, 1 min, 2 min… up to 15 min. */
const retryDelayMs = (attempts: number) => Math.min(30_000 * 2 ** (attempts - 1), 15 * 60_000);

/**
 * "Do this after the request has answered: once, and again if it fails."
 *
 * Work that must not hold a request open (telling a whole Hood about an alert) or that has no
 * request at all is recorded as a job in MongoDB and run by whichever API instance claims it. The
 * record is what makes it reliable: a job survives a restart, a failed one is retried with a growing
 * delay, and one whose worker died mid-run is taken over when its claim lapses.
 *
 * Exactly one instance runs a job at a time (the claim is a single atomic update), but a job can run
 * MORE than once: after a failure, or after a takeover. Handlers must therefore be safe to repeat,
 * like the broadcast delivery in admin/broadcasts.service.ts (a unique key per notification).
 *
 * Modules register a handler for their job type in onModuleInit, the way content types register
 * with the moderation registry, so this module imports none of them.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private timer?: NodeJS.Timeout;
  private pass: Promise<number> | null = null;
  /** Work arrived while a pass was finishing: look once more before stopping. */
  private again = false;
  private stopping = false;

  constructor(@InjectModel(Job.name) private readonly jobs: Model<JobDocument>) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runDue(), POLL_MS);
    this.timer.unref();
  }

  /** Stop taking work and let the job in hand finish, so a deploy doesn't leave it to a 10-minute takeover. */
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.pass?.catch(() => undefined);
  }

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Record a job and start on it straight away on this instance. Resolves once it is recorded, not
   * once it has run. False when `dedupeKey` shows it was already there.
   */
  async enqueue(type: string, payload: Record<string, unknown>, opts: EnqueueOptions = {}): Promise<boolean> {
    try {
      await this.jobs.create({ type, payload, status: "queued", runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, dedupeKey: opts.dedupeKey });
    } catch (err) {
      if (opts.dedupeKey && (err as { code?: number }).code === 11000) return false;
      throw err;
    }
    this.again = true;
    void this.runDue();
    return true;
  }

  /**
   * Run every job that is due, one at a time, until none is left; resolves with how many ran.
   * Callers that arrive while a pass is under way share it.
   */
  runDue(): Promise<number> {
    this.pass ??= this.runPass().finally(() => {
      this.pass = null;
      // A job recorded in the instant this pass was ending found it still "running": pick it up now, not at the next poll.
      if (this.again && !this.stopping) void this.runDue();
    });
    return this.pass;
  }

  /** Resolves when nothing is due and nothing is running here. For tests, and for scripts that must finish their work before exiting. */
  async drain(): Promise<void> {
    for (;;) {
      await this.runDue();
      if (this.stopping) return;
      if (this.again || this.pass) continue;
      const due = await this.jobs.exists({ status: "queued", runAt: { $lte: new Date() }, type: { $in: [...this.handlers.keys()] } }).exec();
      if (!due) return;
    }
  }

  private async runPass(): Promise<number> {
    let ran = 0;
    try {
      do {
        this.again = false;
        for (let job = await this.claim(); job; job = await this.claim()) {
          await this.run(job);
          ran++;
        }
      } while (this.again && !this.stopping);
    } catch (err) {
      // The database is unreachable: the next poll tries again. Never an unhandled rejection from a timer.
      this.logger.error("Couldn't look for jobs", err instanceof Error ? err.stack : String(err));
    }
    return ran;
  }

  /** Take the oldest due job, or one whose worker died. One atomic update, so two instances can't both get it. */
  private async claim(): Promise<JobDocument | null> {
    if (this.stopping) return null;
    const now = new Date();
    return this.jobs
      .findOneAndUpdate(
        {
          // Only what this build knows how to run: during a deploy an older instance leaves newer job types alone.
          type: { $in: [...this.handlers.keys()] },
          $or: [
            { status: "queued", runAt: { $lte: now } },
            { status: "running", lockedUntil: { $lt: now } },
          ],
        },
        { $set: { status: "running", lockedUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
        { sort: { runAt: 1 }, returnDocument: "after" },
      )
      .exec();
  }

  private async run(job: JobDocument): Promise<void> {
    // Taken over from a dead worker once too often: something about this job kills its worker.
    if (job.attempts > job.maxAttempts) {
      await this.settle(job, { status: "failed", finishedAt: new Date(), lastError: "Gave up: the worker stopped mid-run every time." });
      this.logger.error(`Job ${job.type} ${job.id} failed for good: its worker stopped mid-run ${job.maxAttempts} times.`);
      return;
    }
    try {
      await this.handlers.get(job.type)!(job.payload ?? {});
      await this.settle(job, { status: "done", finishedAt: new Date() });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      if (job.attempts >= job.maxAttempts) {
        await this.settle(job, { status: "failed", finishedAt: new Date(), lastError: message });
        this.logger.error(`Job ${job.type} ${job.id} failed for good after ${job.attempts} attempts`, err instanceof Error ? err.stack : String(err));
      } else {
        const delay = retryDelayMs(job.attempts);
        await this.settle(job, { status: "queued", runAt: new Date(Date.now() + delay), lastError: message });
        this.logger.warn(`Job ${job.type} ${job.id} failed (attempt ${job.attempts} of ${job.maxAttempts}); retrying in ${Math.round(delay / 1000)} s: ${message}`);
      }
    }
  }

  /** Record the outcome, but only if the claim is still ours (it isn't if the run outlasted its lease and was taken over). */
  private async settle(job: JobDocument, set: Partial<Pick<Job, "status" | "runAt" | "finishedAt" | "lastError">>): Promise<void> {
    await this.jobs.updateOne({ _id: job._id, status: "running", lockedUntil: job.lockedUntil }, { $set: set, $unset: { lockedUntil: 1 } }).exec();
  }
}
