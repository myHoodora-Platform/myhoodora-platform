import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { reportError } from "@/core/monitoring/monitoring";

/** Coming back to the app checks again at most this often (a launch always checks: app.config.ts updates). */
const RECHECK_MS = 30 * 60 * 1000;

/**
 * Over-the-air JavaScript updates (EAS Update). expo-updates checks and downloads at launch by itself; this
 * also checks when the app comes back to the foreground, since people leave it open for days. Returns
 * whether a downloaded update is waiting, and `restart` to apply it now (otherwise the next launch does).
 */
export function useOtaUpdate(): { ready: boolean; restart: () => void } {
  const { isUpdatePending } = Updates.useUpdates();
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    // The launch just checked.
    lastCheck.current = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync();
          if (check.isAvailable) await Updates.fetchUpdateAsync();
        } catch {
          // Offline or the update server is slow: the next launch tries again.
        }
      })();
    });
    return () => sub.remove();
  }, []);

  const restart = () => {
    Updates.reloadAsync().catch((err: unknown) => reportError(err, "ota-restart"));
  };
  return { ready: Updates.isEnabled && isUpdatePending, restart };
}
