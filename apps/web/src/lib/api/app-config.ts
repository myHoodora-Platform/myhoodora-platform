import type { AppConfig } from "@myhoodora/api-contract/app-config";
import { API_BASE_URL, USE_MOCKS } from "./config";

/** `GET /app-config` (public; contract §41 adds `season`). One request per page load, shared. Null without the API. */
let pending: Promise<AppConfig | null> | null = null;
export function getAppConfig(): Promise<AppConfig | null> {
  if (USE_MOCKS) return Promise.resolve(null);
  pending ??= fetch(`${API_BASE_URL}/app-config`, { signal: AbortSignal.timeout(8_000) })
    .then((r) => (r.ok ? (r.json() as Promise<AppConfig>) : null))
    .catch(() => {
      pending = null; // Ask again next time.
      return null;
    });
  return pending;
}
