import type { Logger } from "@nestjs/common";
import type { RealtimeBus } from "./realtime.bus";
import { InMemoryRealtimeBus } from "./in-memory.bus";

export type BusMode = "auto" | "redis" | "mongo" | "memory";

export interface BusCandidates {
  mode: BusMode;
  redisUrl?: string;
  connectRedis: (url: string) => Promise<RealtimeBus>;
  connectMongo: () => Promise<RealtimeBus>;
  logger: Pick<Logger, "log" | "warn">;
  /** For the startup log line. */
  describe: (bus: RealtimeBus) => string;
}

/**
 * Pick the transport: forced by REALTIME_BUS, otherwise the first that
 * works of Redis → Mongo change streams → in-memory. Never throws; the
 * worst case is in-memory (correct for a single instance) with a warning.
 */
export async function selectRealtimeBus(c: BusCandidates): Promise<RealtimeBus> {
  const done = (bus: RealtimeBus) => {
    c.logger.log(`Realtime bus: ${c.describe(bus)}`);
    return bus;
  };
  const tryRedis = async () => {
    if (!c.redisUrl) return null;
    try {
      return await c.connectRedis(c.redisUrl);
    } catch (err) {
      c.logger.warn(`Realtime: Redis unavailable (${(err as Error).message}).`);
      return null;
    }
  };
  const tryMongo = async () => {
    try {
      return await c.connectMongo();
    } catch (err) {
      c.logger.warn(`Realtime: MongoDB change streams unavailable (${(err as Error).message}).`);
      return null;
    }
  };

  if (c.mode === "memory") return done(new InMemoryRealtimeBus());
  if (c.mode === "redis" || c.mode === "auto") {
    const redis = await tryRedis();
    if (redis) return done(redis);
    if (c.mode === "redis") c.logger.warn("Realtime: REALTIME_BUS=redis but Redis isn't reachable; falling back.");
  }
  const mongo = await tryMongo();
  if (mongo) return done(mongo);
  c.logger.warn("Realtime: using in-memory delivery. Live updates only reach users on the same API instance; run a single instance or configure REDIS_URL.");
  return done(new InMemoryRealtimeBus());
}
