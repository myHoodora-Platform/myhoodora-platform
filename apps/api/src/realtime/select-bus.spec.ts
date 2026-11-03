import { InMemoryRealtimeBus } from "./in-memory.bus";
import type { RealtimeBus } from "./realtime.bus";
import { selectRealtimeBus, type BusCandidates } from "./select-bus";

const named = (name: string) => ({ name, publish: jest.fn(), stream: jest.fn() }) as unknown as RealtimeBus;
const logger = () => ({ log: jest.fn(), warn: jest.fn() });

function candidates(over: Partial<BusCandidates> = {}): BusCandidates {
  return {
    mode: "auto",
    redisUrl: "rediss://example:6379",
    connectRedis: jest.fn(async () => named("redis")),
    connectMongo: jest.fn(async () => named("mongo-change-stream")),
    logger: logger(),
    describe: (b) => b.name,
    ...over,
  };
}

describe("selectRealtimeBus", () => {
  it("prefers Redis when configured and reachable", async () => {
    expect((await selectRealtimeBus(candidates())).name).toBe("redis");
  });

  it("falls back to Mongo change streams when Redis fails", async () => {
    const c = candidates({ connectRedis: jest.fn(async () => Promise.reject(new Error("ECONNREFUSED"))) });
    expect((await selectRealtimeBus(c)).name).toBe("mongo-change-stream");
    expect(c.logger.warn).toHaveBeenCalledWith(expect.stringContaining("Redis unavailable"));
  });

  it("skips Redis without a URL", async () => {
    const c = candidates({ redisUrl: undefined });
    expect((await selectRealtimeBus(c)).name).toBe("mongo-change-stream");
    expect(c.connectRedis).not.toHaveBeenCalled();
  });

  it("ends at in-memory, with a warning, when nothing else works", async () => {
    const c = candidates({
      connectRedis: jest.fn(async () => Promise.reject(new Error("down"))),
      connectMongo: jest.fn(async () => Promise.reject(new Error("change streams not supported"))),
    });
    expect(await selectRealtimeBus(c)).toBeInstanceOf(InMemoryRealtimeBus);
    expect(c.logger.warn).toHaveBeenCalledWith(expect.stringContaining("single instance"));
  });

  it("honours a forced mode", async () => {
    const mem = candidates({ mode: "memory" });
    expect(await selectRealtimeBus(mem)).toBeInstanceOf(InMemoryRealtimeBus);
    expect(mem.connectRedis).not.toHaveBeenCalled();
    const mongo = candidates({ mode: "mongo" });
    expect((await selectRealtimeBus(mongo)).name).toBe("mongo-change-stream");
    expect(mongo.connectRedis).not.toHaveBeenCalled();
  });
});
