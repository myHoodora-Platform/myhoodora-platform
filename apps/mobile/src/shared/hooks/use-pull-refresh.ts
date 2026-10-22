import { errorMessage } from "@myhoodora/api-contract/errors";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useToast } from "@/shared/ui/toast";

/** The first failure among refetch results (TanStack's refetch resolves with `{ error }`, it never throws). */
export function refreshFailure(result: unknown): unknown {
  for (const r of Array.isArray(result) ? result : [result]) {
    if (r && typeof r === "object" && "error" in r && r.error) return r.error;
  }
  return null;
}

/**
 * Pull-to-refresh that spins only when the person pulled. Background refreshes (coming back to the
 * app, a live update, a reconnect) must never show the spinner: on iOS showing it pushes the whole list
 * down and back, which reads as the screen jumping.
 *
 * A pull that fails says so (the spinner stopping with nothing new reads as "nothing happened"); what
 * was already on screen stays.
 */
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const failure = refreshFailure(await refetch());
      if (failure) toast(`Couldn't refresh. ${errorMessage(failure)}`, "error");
    } catch (err) {
      toast(`Couldn't refresh. ${errorMessage(err)}`, "error");
    } finally {
      setRefreshing(false);
    }
  }, [refetch, toast]);
  return { refreshing, onRefresh };
}

/**
 * Scroll props for a list under a fixed header. On iOS the header's height is a content inset, so the
 * pull-to-refresh spinner appears just below the header rather than hidden behind it; Android has no
 * inset, so it pads the content and moves the spinner down instead.
 */
export function underHeader(top: number, bottom: number) {
  if (Platform.OS === "ios") {
    return {
      contentInset: { top, bottom },
      contentOffset: { x: 0, y: -top },
      scrollIndicatorInsets: { top, bottom },
      automaticallyAdjustContentInsets: false,
      contentInsetAdjustmentBehavior: "never" as const,
      padTop: 0,
      padBottom: 0,
      progressViewOffset: 0,
    };
  }
  return { padTop: top, padBottom: bottom, progressViewOffset: top };
}
