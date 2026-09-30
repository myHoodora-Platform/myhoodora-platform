import type { Viewer } from "../shared/auth/viewer";
import { InMemoryRealtimeBus } from "./in-memory.bus";
import type { RealtimeBus } from "./realtime.bus";
import { RealtimeService } from "./realtime.service";
import type { RealtimeEvent } from "./realtime.types";

const viewer = (uid: string, hoodId: string | null, role: Viewer["role"] = "member") =>
  ({ uid, hoodId, role, capabilities: [], accountStatus: "active", verificationStatus: "verified", emailVerified: true, exists: true }) as Viewer;

function listen(service: RealtimeService, v: Viewer) {
  const got: RealtimeEvent[] = [];
  const sub = service.streamFor(v).subscribe((e) => got.push(e));
  return { got, stop: () => sub.unsubscribe() };
}

describe("RealtimeService", () => {
  let service: RealtimeService;
  beforeEach(() => {
    service = new RealtimeService(new InMemoryRealtimeBus());
  });
  afterEach(() => service.onModuleDestroy());

  it("delivers Hood events only to that Hood", () => {
    const lekki = listen(service, viewer("a", "hood-lekki"));
    const ikoyi = listen(service, viewer("b", "hood-ikoyi"));
    service.toHood("hood-lekki", "post.created", { id: "p1" });
    expect(lekki.got.map((e) => e.id)).toEqual(["p1"]);
    expect(ikoyi.got).toEqual([]);
  });

  it("delivers personal events only to that person", () => {
    const a = listen(service, viewer("a", "h"));
    const b = listen(service, viewer("b", "h"));
    service.toUser("a", "notification.created", { id: "n1" });
    expect(a.got).toHaveLength(1);
    expect(b.got).toHaveLength(0);
  });

  it("sends staff events to staff only", () => {
    const member = listen(service, viewer("m", "h"));
    const mod = listen(service, viewer("s", null, "moderator"));
    service.toStaff("inbox.updated", { threadId: "t1" });
    expect(member.got).toHaveLength(0);
    expect(mod.got[0]).toMatchObject({ type: "inbox.updated", threadId: "t1" });
  });

  it("de-duplicates recipients", () => {
    const a = listen(service, viewer("a", null));
    service.toUsers(["a", "a", "a"], "chat.message", { conversationId: "c" });
    expect(a.got).toHaveLength(1);
  });

  it("merges a burst of updates to one post into a single event", () => {
    jest.useFakeTimers();
    const a = listen(service, viewer("a", "h"));
    for (let i = 0; i < 20; i++) service.toHoodCoalesced("h", "post.updated", { id: "p1" });
    service.toHoodCoalesced("h", "post.updated", { id: "p2" });
    expect(a.got).toHaveLength(0);
    jest.advanceTimersByTime(1_000);
    expect(a.got.map((e) => e.id).sort()).toEqual(["p1", "p2"]);
    jest.useRealTimers();
  });

  it("never throws when the transport fails", () => {
    const broken: RealtimeBus = { name: "broken", publish: () => { throw new Error("down"); }, stream: () => { throw new Error("down"); } };
    const s = new RealtimeService(broken);
    expect(() => s.toUser("a", "unread.changed")).not.toThrow();
  });
});
