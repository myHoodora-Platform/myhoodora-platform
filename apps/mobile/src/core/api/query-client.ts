import { ApiError, MAX_RETRY_AFTER_MS } from "@myhoodora/api-contract/errors";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

/**
 * Reads retry once on transient failures (network, timeout, 5xx, the rate limiter), as the web's
 * withRetry does; never on other 4xx. Writes never retry automatically.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || failureCount >= 1) return false;
  if (!error.isRetryable || error.kind === "offline") return false;
  return (error.retryAfterMs ?? 0) <= MAX_RETRY_AFTER_MS;
}

export function retryDelay(attempt: number, error: unknown): number {
  const asked = error instanceof ApiError ? (error.retryAfterMs ?? 0) : 0;
  return Math.max(1000 * 2 ** attempt, asked);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Never wait silently for the network: the request runs at once, and with no connection it fails
      // straight away with "You're offline" (a query that mounted offline would otherwise sit paused
      // under a skeleton for ever). Queries still refetch by themselves when the connection returns.
      queries: { retry: shouldRetry, retryDelay, staleTime: 30_000, networkMode: "offlineFirst" },
      // A send pressed offline says so now, rather than a button that spins until the signal returns.
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

/**
 * React Native has no window focus or online events: tell TanStack Query when the app comes back to
 * the foreground (stale lists refetch) and when the connection returns (paused queries resume).
 * Returns the clean-up.
 */
export function wireQueryEnvironment(): () => void {
  const appState = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") focusManager.setFocused(status === "active");
  });
  // The manager keeps (and replaces) this one listener itself.
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)));
  return () => appState.remove();
}
