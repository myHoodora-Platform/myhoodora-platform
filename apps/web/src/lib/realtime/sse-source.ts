import type { RealtimeHandlers, RealtimeSource } from "./source";
import { SseParser } from "./sse-parser";
import type { RealtimeEvent } from "./types";

/** The server pings every 25 s; silence longer than this means a dead connection. */
const WATCHDOG_MS = 40_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * SSE over fetch. EventSource can't send an Authorization header, so this
 * reads the stream body directly. Reconnects with jittered exponential
 * backoff, asking for a fresh token each time (tokens expire hourly).
 */
export function createSseSource(url: string, getToken: () => Promise<string>): RealtimeSource {
  return {
    connect(handlers: RealtimeHandlers) {
      let closed = false;
      let attempt = 0;
      let controller: AbortController | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;

      const scheduleRetry = () => {
        if (closed) return;
        attempt += 1;
        handlers.onDrop(attempt);
        const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (attempt - 1)) * (0.75 + Math.random() * 0.5);
        retryTimer = setTimeout(() => void run(), delay);
      };

      const run = async () => {
        if (closed) return;
        controller = new AbortController();
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const kick = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => controller?.abort(), WATCHDOG_MS);
        };
        try {
          const token = await getToken();
          kick();
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            cache: "no-store",
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const parser = new SseParser();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            kick();
            for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
              if (frame.event === "ready") {
                attempt = 0;
                handlers.onOpen();
              } else if (frame.event !== "ping") {
                try {
                  handlers.onEvent(JSON.parse(frame.data) as RealtimeEvent);
                } catch {
                  // A malformed frame shouldn't take the connection down.
                }
              }
            }
          }
        } catch {
          // Network error, abort (watchdog) or bad status: retry below.
        } finally {
          clearTimeout(watchdog);
        }
        scheduleRetry();
      };

      void run();
      return () => {
        closed = true;
        clearTimeout(retryTimer);
        controller?.abort();
      };
    },
  };
}
