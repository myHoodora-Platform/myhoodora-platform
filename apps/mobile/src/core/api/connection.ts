import { onlineManager, useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";

/** A request running this long on a phone means the connection is the problem, not the app. */
export const SLOW_AFTER_MS = 8_000;
/** How long "Back online" stays up once the connection returns. */
export const BACK_ONLINE_MS = 2_500;

export type ConnectionNotice = "offline" | "back" | "slow";

/** The one notice to show, most important first: no connection beats a slow one. */
export function noticeFor(state: { online: boolean; justBack: boolean; slow: boolean }): ConnectionNotice | null {
  if (!state.online) return "offline";
  if (state.justBack) return "back";
  if (state.slow) return "slow";
  return null;
}

/** Online as TanStack Query sees it (fed by NetInfo in wireQueryEnvironment), so the two never disagree. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}

/** Calls `onBack` each time the connection returns. */
export function useOnReconnect(onBack: () => void): void {
  useEffect(() => {
    let was = onlineManager.isOnline();
    return onlineManager.subscribe((online) => {
      if (online && !was) onBack();
      was = online;
    });
  }, [onBack]);
}

/**
 * What the connection strip says: offline, back online (briefly), or slow (a load or a send has been
 * running past SLOW_AFTER_MS). Every state change happens in a timer or a subscription.
 */
export function useConnectionNotice(): ConnectionNotice | null {
  const online = useIsOnline();
  const busy = useIsFetching() + useIsMutating() > 0;
  const [backAt, setBackAt] = useState<number | null>(null);
  const [slowSince, setSlowSince] = useState<number | null>(null);

  useEffect(() => {
    let was = onlineManager.isOnline();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onlineManager.subscribe((now) => {
      if (now && !was) {
        setBackAt(Date.now());
        clearTimeout(timer);
        timer = setTimeout(() => setBackAt(null), BACK_ONLINE_MS);
      }
      if (!now) setBackAt(null);
      was = now;
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlowSince(Date.now()), SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlowSince(null);
    };
  }, [busy]);

  return noticeFor({ online, justBack: backAt !== null, slow: busy && slowSince !== null });
}
