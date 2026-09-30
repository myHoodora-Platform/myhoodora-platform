import { Logger, type OnModuleDestroy } from "@nestjs/common";
import { Redis, type RedisOptions } from "ioredis";
import { DistributedBus } from "./distributed.bus";
import type { RealtimeEvent } from "./realtime.types";

/** The slice of an ioredis client this bus uses (lets tests pass fakes). */
export interface RedisPublisher {
  status: string;
  publish(channel: string, message: string): Promise<number>;
  quit(): Promise<unknown>;
}
export interface RedisSubscriber {
  subscribe(channel: string): Promise<unknown>;
  on(event: "message", listener: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
}

const OPTIONS: RedisOptions = {
  lazyConnect: true,
  // Upstash may close idle TCP connections; keep-alives and auto-reconnect
  // (with re-subscribe, ioredis' default) keep the subscriber alive.
  keepAlive: 30_000,
  maxRetriesPerRequest: 2,
  retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
  connectionName: "myhoodora-realtime",
};

/**
 * Redis pub/sub across API instances (Upstash in production). One Redis
 * channel per environment carries every event, so each event costs exactly
 * one PUBLISH, and each instance holds one subscription however many
 * browsers are connected. The instance hears its own messages back through
 * the subscription, so there's no separate local delivery (no duplicates).
 */
export class RedisRealtimeBus extends DistributedBus implements OnModuleDestroy {
  readonly name = "redis";
  private readonly logger = new Logger(RedisRealtimeBus.name);
  private warnedDown = false;

  constructor(
    private readonly pub: RedisPublisher,
    private readonly sub: RedisSubscriber,
    readonly redisChannel: string,
  ) {
    super();
    this.sub.on("message", (ch, message) => {
      if (ch !== this.redisChannel) return;
      try {
        this.receive(JSON.parse(message));
      } catch {
        this.logger.warn("Ignored a malformed realtime message.");
      }
    });
  }

  /** Connect both clients and subscribe, or throw (the caller falls back). */
  static async connect(url: string, redisChannel: string, timeoutMs = 5_000): Promise<RedisRealtimeBus> {
    const pub = new Redis(url, OPTIONS);
    const sub = new Redis(url, OPTIONS);
    const logger = new Logger(RedisRealtimeBus.name);
    // Transient errors are retried by ioredis; log them without crashing.
    for (const c of [pub, sub]) c.on("error", (err: Error) => logger.warn(`Redis: ${err.message}`));
    try {
      await withTimeout(Promise.all([pub.connect(), sub.connect()]), timeoutMs);
      const bus = new RedisRealtimeBus(pub, sub, redisChannel);
      await withTimeout(sub.subscribe(redisChannel), timeoutMs);
      return bus;
    } catch (err) {
      pub.disconnect();
      sub.disconnect();
      throw err;
    }
  }

  publish(channel: string, event: RealtimeEvent): void {
    if (this.pub.status !== "ready") {
      this.degrade(channel, event, `publisher is ${this.pub.status}`);
      return;
    }
    this.pub
      .publish(this.redisChannel, JSON.stringify({ ch: channel, e: event }))
      .then(() => (this.warnedDown = false))
      .catch((err: Error) => this.degrade(channel, event, err.message));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }

  /** Redis unreachable: at least this instance's users still get it; others resync on reconnect. */
  private degrade(channel: string, event: RealtimeEvent, why: string): void {
    if (!this.warnedDown) {
      this.warnedDown = true;
      this.logger.warn(`Realtime publish via Redis failed (${why}); delivering on this instance only until it recovers.`);
    }
    this.deliverLocally(channel, event);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
