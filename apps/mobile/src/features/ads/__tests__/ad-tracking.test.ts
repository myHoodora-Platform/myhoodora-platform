import type { User } from "@firebase/auth";
import { AdTracker, newFeedSession } from "../ad-tracking";

jest.mock("@/features/feed/feed-api", () => ({ sendAdEvents: jest.fn() }));

const user = { uid: "u1" } as User;
const ev = (adId: string, type: "impression" | "click" = "impression", sessionId = "session01") => ({ adId, type, sessionId });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("AdTracker", () => {
  it("batches events and sends each one once per session and kind", async () => {
    const send = jest.fn().mockResolvedValue({});
    const tracker = new AdTracker(send);
    tracker.track(user, ev("a"));
    tracker.track(user, ev("a"));
    tracker.track(user, ev("a", "click"));
    tracker.track(user, ev("a", "impression", "session02"));
    expect(send).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(3_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual([ev("a"), ev("a", "click"), ev("a", "impression", "session02")]);
  });

  it("sends at once when many are waiting", async () => {
    const send = jest.fn().mockResolvedValue({});
    const tracker = new AdTracker(send);
    for (let i = 0; i < 20; i++) tracker.track(user, ev(`ad${i}`));
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries a failed batch once, then drops it", async () => {
    const send = jest.fn().mockRejectedValue(new Error("offline"));
    const tracker = new AdTracker(send);
    tracker.track(user, ev("a"));
    await jest.advanceTimersByTimeAsync(3_000);
    await jest.advanceTimersByTimeAsync(6_000);
    expect(send).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("makes session ids the API accepts", () => {
    for (let i = 0; i < 20; i++) expect(newFeedSession()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
