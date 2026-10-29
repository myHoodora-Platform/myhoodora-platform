import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { openEventStream } from "@/core/realtime/sse-client";
import { liveBus } from "./live-bus";
import { applyLiveEvent, type LiveEvent } from "./live-events";
import { liveStore } from "./live-store";

/** Reconnect waits (contract §19): 1 s doubling to 30 s, with jitter so phones don't reconnect in step. */
export function backoffMs(attempt: number, random = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base / 2 + random() * (base / 2));
}

/** After this many failures in a row, screens poll until the stream recovers. */
const FAILURES_BEFORE_POLLING = 3;

/**
 * The app's one live connection while signed in and in the foreground. Events refresh what changed;
 * every reconnect refreshes what's on screen (anything may have changed while it was down); closing
 * in the background saves battery and data.
 */
export function useLiveUpdates() {
  const user = useSignedInUser();
  const { refreshProfile } = useAuth();
  const client = useQueryClient();

  useEffect(() => {
    let close: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;
    let everOpened = false;

    const connect = async () => {
      if (stopped) return;
      clearTimeout(retry);
      liveStore.setStatus(failures >= FAILURES_BEFORE_POLLING ? "polling" : "connecting");
      let token: string;
      try {
        token = await user.getIdToken(); // a fresh one each time
      } catch {
        return schedule();
      }
      if (stopped) return;
      close = openEventStream(`${config().apiUrl}/realtime/stream`, token, {
        onOpen: () => {
          failures = 0;
          liveStore.setStatus("live");
          // Resync: whatever is on screen may have changed while we weren't listening.
          if (everOpened) void client.invalidateQueries();
          everOpened = true;
        },
        onEvent: ({ event, data }) => {
          if (event === "ready" || event === "ping") return;
          let parsed: LiveEvent;
          try {
            parsed = { ...(JSON.parse(data) as LiveEvent), type: event };
          } catch {
            return;
          }
          liveBus.emit(parsed);
          if (applyLiveEvent(client, parsed)) {
            // Hood, verification or role changed: new channels, and a new profile.
            void refreshProfile();
            restart();
          }
        },
        onClose: (failed) => {
          close = null;
          if (stopped) return;
          if (failed) failures += 1;
          schedule();
        },
      });
    };

    const schedule = () => {
      if (stopped) return;
      if (failures >= FAILURES_BEFORE_POLLING) liveStore.setStatus("polling");
      retry = setTimeout(() => void connect(), backoffMs(failures));
    };

    const restart = () => {
      close?.();
      close = null;
      void connect();
    };

    void connect();
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        if (!close) {
          failures = 0;
          void connect();
        }
      } else if (s === "background") {
        clearTimeout(retry);
        close?.();
        close = null;
        liveStore.setStatus("connecting");
      }
    });

    return () => {
      stopped = true;
      clearTimeout(retry);
      close?.();
      appState.remove();
    };
  }, [user, client, refreshProfile]);
}
