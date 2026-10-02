import { Logger, type OnModuleDestroy } from "@nestjs/common";
import type { Connection } from "mongoose";
import { DistributedBus } from "./distributed.bus";
import type { RealtimeEvent } from "./realtime.types";

/** The slice of the MongoDB driver this bus uses (lets tests pass fakes). */
export interface ChangeStreamLike {
  on(event: "change", listener: (change: { _id: unknown; fullDocument?: unknown }) => void): unknown;
  on(event: "error", listener: (err: Error & { code?: number }) => void): unknown;
  tryNext(): Promise<unknown>;
  close(): Promise<unknown>;
}
export interface EventsCollection {
  insertOne(doc: Record<string, unknown>): Promise<unknown>;
  watch(pipeline: Record<string, unknown>[], options?: Record<string, unknown>): ChangeStreamLike;
}

const COLLECTION = "realtime_events";
/** Events only need to live long enough to be streamed. */
const TTL_SECONDS = 60;
const MAX_BACKOFF_MS = 30_000;
/** Resume token too old for the oplog: start fresh (clients resync anyway). */
const HISTORY_LOST = 286;

/**
 * MongoDB change streams across API instances: the fallback when Redis
 * isn't available, using the database we already run. publish() is one
 * insert into a TTL'd collection; each instance watches it once.
 */
export class MongoChangeStreamBus extends DistributedBus implements OnModuleDestroy {
  readonly name = "mongo-change-stream";
  private readonly logger = new Logger(MongoChangeStreamBus.name);
  private changeStream?: ChangeStreamLike;
  private resumeToken?: unknown;
  private attempt = 0;
  private closed = false;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly events: EventsCollection,
    private readonly env: string,
  ) {
    super();
  }

  /** Probe support (tier, replica set), then start watching; throws if unsupported. */
  static async connect(connection: Connection, env: string): Promise<MongoChangeStreamBus> {
    const db = connection.db;
    if (!db) throw new Error("MongoDB isn't connected");
    const coll = db.collection(COLLECTION);
    await coll.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, env);
    // A throwaway iterator: fails fast if change streams aren't supported here.
    const probe = bus.events.watch(bus.pipeline());
    try {
      await probe.tryNext();
    } finally {
      await probe.close().catch(() => undefined);
    }
    bus.open();
    return bus;
  }

  publish(channel: string, event: RealtimeEvent): void {
    this.events.insertOne({ env: this.env, ch: channel, e: event, createdAt: new Date() }).catch((err: Error) => {
      this.logger.warn(`Realtime insert failed (${err.message}); delivering on this instance only.`);
      this.deliverLocally(channel, event);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    clearTimeout(this.retryTimer);
    await this.changeStream?.close().catch(() => undefined);
  }

  private pipeline(): Record<string, unknown>[] {
    return [{ $match: { operationType: "insert", "fullDocument.env": this.env } }];
  }

  private open(): void {
    if (this.closed) return;
    const stream = this.events.watch(this.pipeline(), this.resumeToken ? { resumeAfter: this.resumeToken } : {});
    this.changeStream = stream;
    stream.on("change", (change) => {
      this.attempt = 0;
      this.resumeToken = change._id;
      const doc = change.fullDocument as { ch?: unknown; e?: unknown } | undefined;
      this.receive(doc && { ch: doc.ch, e: doc.e });
    });
    stream.on("error", (err) => {
      if (this.closed || this.changeStream !== stream) return;
      if (err.code === HISTORY_LOST) this.resumeToken = undefined;
      this.attempt += 1;
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (this.attempt - 1));
      this.logger.warn(`Realtime change stream error (${err.message}); reopening in ${delay} ms.`);
      void stream.close().catch(() => undefined);
      this.retryTimer = setTimeout(() => this.open(), delay);
    });
  }
}
