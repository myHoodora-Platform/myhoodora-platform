import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobDocument = HydratedDocument<Job>;

/** One piece of work to do after a request has answered (see JobsService). */
@Schema({ timestamps: true, collection: "jobs" })
export class Job {
  /** Which handler runs it, e.g. "alert.fanout". */
  @Prop({ required: true })
  type!: string;

  /** What the handler needs: ids, not copies of documents, so it always works on current data. */
  @Prop({ type: Object, default: () => ({}) })
  payload!: Record<string, unknown>;

  @Prop({ required: true, enum: JOB_STATUSES, default: "queued" })
  status!: JobStatus;

  /** Not before this moment. Pushed back after each failed attempt. */
  @Prop({ required: true })
  runAt!: Date;

  /** Times it has been started, including the one in progress. */
  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ required: true })
  maxAttempts!: number;

  /** While running: when the claim lapses, so another instance can take over from a worker that died. */
  @Prop({ type: Date })
  lockedUntil?: Date;

  /** Why the last attempt failed (message only). */
  @Prop({ maxlength: 500 })
  lastError?: string;

  /** Set to make enqueueing idempotent: a second job with the same key is never added. */
  @Prop()
  dedupeKey?: string;

  @Prop({ type: Date })
  finishedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);
// Claiming: the oldest job that is due.
JobSchema.index({ status: 1, runAt: 1 });
JobSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
// Finished jobs are kept a week (their dedupeKey keeps guarding against a late duplicate), then go. Failed ones stay for someone to look at.
JobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { status: "done" } });
