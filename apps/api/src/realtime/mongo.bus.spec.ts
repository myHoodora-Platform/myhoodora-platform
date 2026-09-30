import { EventEmitter } from "node:events";
import { MongoChangeStreamBus, type ChangeStreamLike, type EventsCollection } from "./mongo.bus";
import type { RealtimeEvent } from "./realtime.types";

const event = (id: string): RealtimeEvent => ({ type: "chat.message", conversationId: id, at: "2026-09-30T00:00:00.000Z" });

function fakeCollection() {
  const streams: (EventEmitter & ChangeStreamLike & { options?: Record<string, unknown> })[] = [];
  const coll = {
    insertOne: jest.fn(async () => ({ acknowledged: true })),
    watch: jest.fn((_pipeline: Record<string, unknown>[], options?: Record<string, unknown>) => {
      const s = Object.assign(new EventEmitter(), { options, tryNext: jest.fn(async () => null), close: jest.fn(async () => undefined) });
      streams.push(s as never);
      return s as unknown as ChangeStreamLike;
    }),
  };
  return { coll, streams };
}

/** Start watching without a real connection (connect() does the probe + index). */
function start(bus: MongoChangeStreamBus) {
  (bus as unknown as { open: () => void }).open();
}

describe("MongoChangeStreamBus", () => {
  afterEach(() => jest.useRealTimers());

  it("publishes as one insert tagged with the environment", () => {
    const { coll } = fakeCollection();
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, "development");
    bus.publish("user:u1", event("c1"));
    expect(coll.insertOne).toHaveBeenCalledWith(expect.objectContaining({ env: "development", ch: "user:u1", e: event("c1") }));
  });

  it("watches only this environment's inserts and delivers them", () => {
    const { coll, streams } = fakeCollection();
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, "development");
    start(bus);
    expect(coll.watch.mock.calls[0]![0]).toEqual([{ $match: { operationType: "insert", "fullDocument.env": "development" } }]);
    const got: RealtimeEvent[] = [];
    bus.stream(["user:u1"]).subscribe((e) => got.push(e));
    streams[0]!.emit("change", { _id: { token: 1 }, fullDocument: { env: "development", ch: "user:u1", e: event("c1") } });
    streams[0]!.emit("change", { _id: { token: 2 }, fullDocument: { env: "development", ch: "user:u2", e: event("c2") } });
    expect(got.map((e) => e.conversationId)).toEqual(["c1"]);
  });

  it("reopens after an error, resuming from the last event", () => {
    jest.useFakeTimers();
    const { coll, streams } = fakeCollection();
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, "development");
    start(bus);
    streams[0]!.emit("change", { _id: { token: 7 }, fullDocument: { env: "development", ch: "x", e: event("c") } });
    streams[0]!.emit("error", Object.assign(new Error("network"), { code: 6 }));
    jest.advanceTimersByTime(500);
    expect(streams).toHaveLength(2);
    expect(streams[1]!.options).toEqual({ resumeAfter: { token: 7 } });
  });

  it("starts fresh when resume history is gone", () => {
    jest.useFakeTimers();
    const { coll, streams } = fakeCollection();
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, "development");
    start(bus);
    streams[0]!.emit("change", { _id: { token: 7 }, fullDocument: { env: "development", ch: "x", e: event("c") } });
    streams[0]!.emit("error", Object.assign(new Error("history lost"), { code: 286 }));
    jest.advanceTimersByTime(500);
    expect(streams[1]!.options).toEqual({});
  });

  it("falls back to this instance if an insert fails", async () => {
    const { coll } = fakeCollection();
    coll.insertOne.mockRejectedValueOnce(new Error("write failed"));
    const bus = new MongoChangeStreamBus(coll as unknown as EventsCollection, "development");
    const got: RealtimeEvent[] = [];
    bus.stream(["user:u1"]).subscribe((e) => got.push(e));
    bus.publish("user:u1", event("c1"));
    await new Promise((r) => setImmediate(r));
    expect(got).toHaveLength(1);
  });
});
