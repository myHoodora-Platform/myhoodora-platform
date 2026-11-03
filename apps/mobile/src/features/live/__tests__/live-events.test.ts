import { QueryClient } from "@tanstack/react-query";
import { applyLiveEvent } from "../live-events";
import { NEW_POST_SETTLE_MS, liveStore } from "../live-store";
import { backoffMs } from "../use-live-updates";

jest.mock("@/core/auth/auth-provider", () => ({}));
jest.mock("@/core/push/use-push-notifications", () => ({ NOTIFICATIONS_QUERY_KEY: ["notifications"] }));
jest.mock("@/core/api/client", () => ({ apiFetch: jest.fn() }));

const stale = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

function seeded() {
  const client = new QueryClient();
  for (const key of [["feed", "h1", "all"], ["post", "p1"], ["post", "p1", "comments"], ["conversations"], ["conversations", "c1", "messages"], ["notifications"], ["listings", "h1", "all"]]) client.setQueryData(key, []);
  return client;
}

describe("live events", () => {
  beforeEach(() => liveStore.clearNewPosts());

  it("a new comment refreshes that post and its comments only", () => {
    const client = seeded();
    applyLiveEvent(client, { type: "comment.created", postId: "p1" });
    expect(stale(client, ["post", "p1", "comments"])).toBe(true);
    expect(stale(client, ["post", "p1"])).toBe(true);
    expect(stale(client, ["feed", "h1", "all"])).toBe(false);
  });

  it("a message refreshes conversations (list, unread count and threads)", () => {
    const client = seeded();
    applyLiveEvent(client, { type: "chat.message", conversationId: "c1" });
    expect(stale(client, ["conversations", "c1", "messages"])).toBe(true);
    expect(stale(client, ["notifications"])).toBe(false);
  });

  // Regression (2026-10-29): reading a support conversation left "1" on its Messages row.
  it("something read refreshes the unread counts (notifications, support, chats) and the support list", () => {
    const client = seeded();
    for (const key of [["support", "unread"], ["support", "threads"], ["support", "thread", "t1"], ["conversations", "unread"]]) client.setQueryData(key, []);
    applyLiveEvent(client, { type: "unread.changed" });
    expect(stale(client, ["notifications"])).toBe(true);
    expect(stale(client, ["support", "unread"])).toBe(true);
    expect(stale(client, ["support", "threads"])).toBe(true);
    expect(stale(client, ["conversations", "unread"])).toBe(true);
    // Not the conversations themselves: reading one doesn't change what's in it.
    expect(stale(client, ["support", "thread", "t1"])).toBe(false);
    expect(stale(client, ["conversations", "c1", "messages"])).toBe(false);
  });

  it("a new post never moves the feed: it's counted for the 'new posts' pill", () => {
    const client = seeded();
    jest.useFakeTimers();
    applyLiveEvent(client, { type: "post.created", id: "p9" });
    expect(stale(client, ["feed", "h1", "all"])).toBe(false);
    jest.advanceTimersByTime(NEW_POST_SETTLE_MS);
    expect(liveStore.get().newPosts).toBe(1);
    jest.useRealTimers();
  });

  it("your own new post isn't news to you, even when its event beats the reply to your POST", () => {
    jest.useFakeTimers();
    applyLiveEvent(seeded(), { type: "post.created", id: "mine" });
    liveStore.markOwnPost("mine");
    jest.advanceTimersByTime(NEW_POST_SETTLE_MS);
    expect(liveStore.get().newPosts).toBe(0);
    jest.useRealTimers();
  });

  it("asks for a reconnect when the session changes", () => {
    expect(applyLiveEvent(seeded(), { type: "session.changed" })).toBe(true);
    expect(applyLiveEvent(seeded(), { type: "notification.created" })).toBe(false);
  });
});

describe("reconnect backoff", () => {
  it("grows from about a second to at most 30 s, with jitter", () => {
    expect(backoffMs(0, () => 0)).toBe(500);
    expect(backoffMs(0, () => 1)).toBe(1000);
    expect(backoffMs(3, () => 1)).toBe(8000);
    expect(backoffMs(10, () => 1)).toBe(30_000);
  });
});
