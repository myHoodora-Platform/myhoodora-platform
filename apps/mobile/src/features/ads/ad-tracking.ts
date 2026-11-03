import type { User } from "@firebase/auth";
import type { AdEventInput } from "@myhoodora/api-contract/ads";
import { sendAdEvents } from "@/features/feed/feed-api";

/** A new feed session id: whenever the feed opens or is refreshed (contract §32: 8–64 of A–Z a–z 0–9 - _). */
export function newFeedSession(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Sent together after this long, or sooner once this many are waiting. */
const FLUSH_AFTER_MS = 3_000;
const FLUSH_AT = 20;

/**
 * Impressions and clicks, sent in the background a batch at a time. Each counts once per ad, feed
 * session and kind on the API (a unique key); this also drops repeats on the phone, so scrolling an
 * ad in and out sends nothing more. A batch that fails is tried once more with the next one, then
 * dropped: stats aren't worth a person's data or battery.
 */
export class AdTracker {
  private queue: AdEventInput[] = [];
  private sent = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private user: User | null = null;
  private retried = false;

  constructor(private readonly send: (user: User, events: AdEventInput[]) => Promise<unknown> = sendAdEvents) {}

  track(user: User, event: AdEventInput): void {
    const key = `${event.sessionId}:${event.adId}:${event.type}`;
    if (this.sent.has(key)) return;
    this.sent.add(key);
    this.user = user;
    this.queue.push(event);
    if (this.queue.length >= FLUSH_AT) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => void this.flush(), FLUSH_AFTER_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = this.queue.splice(0, 50);
    if (!batch.length || !this.user) return;
    try {
      await this.send(this.user, batch);
      this.retried = false;
    } catch {
      // Once more with the next batch (the API ignores what it already has), then let it go.
      if (!this.retried) {
        this.retried = true;
        this.queue.unshift(...batch);
        if (!this.timer) this.timer = setTimeout(() => void this.flush(), FLUSH_AFTER_MS * 2);
      } else this.retried = false;
    }
  }
}

export const adTracker = new AdTracker();
