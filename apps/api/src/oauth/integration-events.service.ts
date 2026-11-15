import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { signWebhook } from "../communications/webhook-signature";
import { JobsService } from "../jobs/jobs.service";
import { User } from "../users/schemas/user.schema";
import { subjectSnapshot } from "./domain/subject";
import type { OAuthConfig } from "./oauth.config";
import { IntegrationLink } from "./oauth.schemas";
import { OAUTH_CONFIG } from "./oauth.tokens";

export const EVENT_JOB = "integration.event";

export type AccountEventType =
  | "account.updated"
  | "account.sessions_revoked"
  | "account.deleted";

interface EventJob {
  eventId: string;
  type: AccountEventType;
  clientId: string;
  uid: string;
  /** account.deleted only: the link is gone by the time it's delivered. */
  sub?: string;
  occurredAt: string;
  attempt: number;
}

/**
 * Contract §8.1: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h after each failed delivery; then it's given up and
 * logged as an error for staff (a dead letter). myHoodora AI's own checks (§9) cover what was missed.
 */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 3_600_000,
  6 * 3_600_000,
  12 * 3_600_000,
];
/** Answers that will never succeed on a retry (contract §8.1). */
const PERMANENT = new Set([400, 401, 404, 422]);
const TIMEOUT_MS = 10_000;

/**
 * Account events for myHoodora AI (docs/integrations/myhoodora-ai.md §8). Each change is recorded as a
 * job (the durable outbox), delivered signed, and retried on the contract's timetable. Only people who
 * have signed in to a client get events, and only that client gets them.
 *
 * `account.updated` carries the account's state when it's delivered, not when it was queued: a change
 * whose transaction rolled back just re-sends the state as it is, which is harmless.
 */
@Injectable()
export class IntegrationEventsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationEventsService.name);

  constructor(
    @Inject(OAUTH_CONFIG) private readonly config: OAuthConfig,
    @InjectModel(IntegrationLink.name)
    private readonly links: Model<IntegrationLink>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(EVENT_JOB, (payload) =>
      this.deliver(payload as unknown as EventJob),
    );
  }

  private get on(): boolean {
    return (
      this.config.enabled &&
      Boolean(this.config.events?.url && this.config.events.secrets.length)
    );
  }

  /**
   * Something about this account changed (status, email, sessions). Never throws: an event that can't be
   * queued must not fail the change itself, and myHoodora AI re-checks accounts on its own (§9).
   * `delayMs`: for changes made inside a caller's transaction, so delivery reads the committed state.
   */
  async accountChanged(
    uid: string,
    type: Exclude<AccountEventType, "account.deleted"> = "account.updated",
    delayMs = 0,
  ): Promise<void> {
    if (!this.on) return;
    try {
      const links = await this.links
        .find({ uid })
        .select({ clientId: 1 })
        .lean<Pick<IntegrationLink, "clientId">[]>()
        .exec();
      const occurredAt = new Date().toISOString();
      for (const { clientId } of links) {
        await this.enqueue(
          {
            eventId: newEventId(),
            type,
            clientId,
            uid,
            occurredAt,
            attempt: 1,
          },
          delayMs,
        );
      }
    } catch (err) {
      this.logger.error(`Couldn't queue ${type}: ${(err as Error).message}`);
    }
  }

  /** The account is being deleted for good: one account.deleted per client, before its links go. */
  async accountDeleted(
    uid: string,
    links: Pick<IntegrationLink, "clientId" | "sub">[],
  ): Promise<void> {
    if (!this.on) return;
    const occurredAt = new Date().toISOString();
    for (const { clientId, sub } of links) {
      await this.enqueue({
        eventId: newEventId(),
        type: "account.deleted",
        clientId,
        uid,
        sub,
        occurredAt,
        attempt: 1,
      });
    }
  }

  private enqueue(job: EventJob, delayMs = 0) {
    return this.jobs.enqueue(
      EVENT_JOB,
      { ...job },
      {
        // Retries are scheduled here, on the contract's timetable, not by the job queue's own backoff.
        maxAttempts: 1,
        runAt: new Date(Date.now() + delayMs),
        dedupeKey: `${job.eventId}:${job.attempt}`,
      },
    );
  }

  /** One delivery attempt. Never throws: a failure schedules the next attempt, or gives up. */
  async deliver(job: EventJob): Promise<void> {
    if (!this.on) return;
    let status = 0;
    try {
      const event = await this.build(job);
      if (!event) return; // The account or its link is gone, and with it anything to say.
      const body = JSON.stringify(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = this.config
        .events!.secrets.map((secret) =>
          signWebhook(secret, job.eventId, timestamp, body),
        )
        .join(" ");
      const res = await fetch(this.config.events!.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": job.eventId,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
    } catch {
      status = 0; // Unreachable, too slow, or our own database blinked: worth another try.
    }
    if (status >= 200 && status < 300) return;

    // Event ids and types only: never who it was about.
    if (PERMANENT.has(status)) {
      this.logger.error(
        `Event ${job.eventId} (${job.type}) refused by ${job.clientId} with ${status}: not retried (dead letter)`,
      );
      return;
    }
    const delay = RETRY_DELAYS_MS[job.attempt - 1];
    if (delay === undefined) {
      this.logger.error(
        `Event ${job.eventId} (${job.type}) to ${job.clientId} given up after ${job.attempt} attempts (dead letter)`,
      );
      return;
    }
    this.logger.warn(
      `Event ${job.eventId} (${job.type}) to ${job.clientId} failed (${status || "no answer"}); attempt ${job.attempt + 1} in ${delay / 60_000} min`,
    );
    await this.enqueue({ ...job, attempt: job.attempt + 1 }, delay);
  }

  private async build(job: EventJob): Promise<Record<string, unknown> | null> {
    const envelope = (data: Record<string, unknown>) => ({
      id: job.eventId,
      type: job.type,
      version: 1,
      occurred_at: job.occurredAt,
      data,
    });
    if (job.type === "account.deleted")
      return job.sub
        ? envelope({ sub: job.sub, deleted_at: job.occurredAt })
        : null;

    const link = await this.links
      .findOne({ clientId: job.clientId, uid: job.uid })
      .lean<IntegrationLink>()
      .exec();
    if (!link) return null;
    if (job.type === "account.sessions_revoked")
      return envelope({ sub: link.sub, revoked_at: job.occurredAt });
    const user = await this.users.findOne({ uid: job.uid }).lean<User>().exec();
    return user ? envelope({ ...subjectSnapshot(user, link.sub) }) : null;
  }
}

/** Sortable enough to read in logs; unique is what matters. */
function newEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "")}`;
}
