import { EventEmitter } from "node:events";
import { RedisRealtimeBus, type RedisPublisher, type RedisSubscriber } from "./redis.bus";
import type { RealtimeEvent } from "./realtime.types";

const CH = "myhoodora:realtime:test";
const event = (id: string): RealtimeEvent => ({ type: "post.created", id, at: "2026-09-30T00:00:00.000Z" });

function fakes() {
  const sub = Object.assign(new EventEmitter(), { subscribe: jest.fn(async () => 1), quit: jest.fn(async () => "OK") });
  const pub = {
    status: "ready",
    // Like real Redis: what's published comes back to every subscriber, this instance included.
    publish: jest.fn(async (ch: string, msg: string) => {
      sub.emit("message", ch, msg);
      return 1;
    }),
    quit: jest.fn(async () => "OK"),
  };
  return { pub, sub };
}

describe("RedisRealtimeBus", () => {
  it("publishes one message per event on this environment's channel", () => {
    const { pub, sub } = fakes();
    const bus = new RedisRealtimeBus(pub as RedisPublisher, sub as unknown as RedisSubscriber, CH);
    bus.publish("hood:h1", event("p1"));
    expect(pub.publish).toHaveBeenCalledTimes(1);
    expect(pub.publish).toHaveBeenCalledWith(CH, JSON.stringify({ ch: "hood:h1", e: event("p1") }));
  });

  it("delivers what comes back from Redis once, to matching streams only", async () => {
    const { pub, sub } = fakes();
    const bus = new RedisRealtimeBus(pub as RedisPublisher, sub as unknown as RedisSubscriber, CH);
    const h1: RealtimeEvent[] = [];
    const h2: RealtimeEvent[] = [];
    bus.stream(["hood:h1"]).subscribe((e) => h1.push(e));
    bus.stream(["hood:h2"]).subscribe((e) => h2.push(e));
    bus.publish("hood:h1", event("p1"));
    await new Promise((r) => setImmediate(r));
    expect(h1.map((e) => e.id)).toEqual(["p1"]);
    expect(h2).toEqual([]);
  });

  it("ignores other environments' channels and malformed messages", () => {
    const { pub, sub } = fakes();
    const bus = new RedisRealtimeBus(pub as RedisPublisher, sub as unknown as RedisSubscriber, CH);
    const got: RealtimeEvent[] = [];
    bus.stream(["hood:h1"]).subscribe((e) => got.push(e));
    sub.emit("message", "myhoodora:realtime:production", JSON.stringify({ ch: "hood:h1", e: event("prod") }));
    sub.emit("message", CH, "not json");
    sub.emit("message", CH, JSON.stringify({ nope: true }));
    expect(got).toEqual([]);
  });

  it("falls back to this instance while Redis is down", async () => {
    const { pub, sub } = fakes();
    pub.status = "reconnecting";
    const bus = new RedisRealtimeBus(pub as RedisPublisher, sub as unknown as RedisSubscriber, CH);
    const got: RealtimeEvent[] = [];
    bus.stream(["user:u1"]).subscribe((e) => got.push(e));
    bus.publish("user:u1", event("n1"));
    expect(pub.publish).not.toHaveBeenCalled();
    expect(got.map((e) => e.id)).toEqual(["n1"]);

    pub.status = "ready";
    pub.publish.mockRejectedValueOnce(new Error("connection reset"));
    bus.publish("user:u1", event("n2"));
    await new Promise((r) => setImmediate(r));
    expect(got.map((e) => e.id)).toEqual(["n1", "n2"]);
  });

  it("closes both connections on shutdown", async () => {
    const { pub, sub } = fakes();
    await new RedisRealtimeBus(pub as RedisPublisher, sub as unknown as RedisSubscriber, CH).onModuleDestroy();
    expect(pub.quit).toHaveBeenCalled();
    expect(sub.quit).toHaveBeenCalled();
  });
});
