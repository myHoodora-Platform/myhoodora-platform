import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { ApiError, FRIENDLY_MESSAGES, REQUEST_TIMEOUT_MS, errorFor, isHtmlPage, transportError } from "@myhoodora/api-contract/errors";
import type { User } from "@firebase/auth";
import { config } from "@/core/config/env";
import { reportEdgePage } from "@/core/monitoring/monitoring";

/**
 * Requests to the API, and to the web server's address lookups, with the signed-in person's
 * Firebase ID token. Errors are classified exactly as on the web (@myhoodora/api-contract), so
 * the same failure reads the same in both apps (docs/api-contract.md §0).
 */
export type RequestInitWithJson = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit;
  /** Longer than the default for uploads on slow mobile data. */
  timeoutMs?: number;
};

/** Called with every 401, so the session can end (a 503 never counts: contract §26). */
let onUnauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

async function isOffline(): Promise<boolean> {
  const state = await NetInfo.fetch().catch(() => null);
  return state?.isConnected === false;
}

async function request<T>(url: string, user: User | null, init: RequestInitWithJson = {}): Promise<T> {
  const { json, headers, signal, timeoutMs = REQUEST_TIMEOUT_MS, ...rest } = init;
  // Always try: NetInfo can miss a reconnect (the iOS simulator always does), and a request that
  // gets through is better proof than its say-so. "Offline" is only the reason once one fails.
  const token = user
    ? await user.getIdToken().catch(async () => {
        throw transportError((await isOffline()) ? "offline" : "network");
      })
    : null;
  // AbortSignal.timeout is not guaranteed under Hermes: a timer and a controller do the same job.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    if (timedOut) throw transportError("timeout");
    if (signal?.aborted) throw new ApiError("Cancelled", 0, "network");
    throw transportError((await isOffline()) ? "offline" : "network");
  } finally {
    clearTimeout(timer);
  }
  // Any answer means we're connected, whatever NetInfo last said: clear the strip, resume paused loads.
  if (!onlineManager.isOnline()) onlineManager.setOnline(true);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (isHtmlPage(text)) reportPage(response, url);
    const error = errorFor(response.status, text, response.headers.get("Retry-After"));
    if (error.kind === "auth") onUnauthorized?.();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  try {
    return (text ? JSON.parse(text) : undefined) as T;
  } catch {
    // A 2xx that isn't JSON (a proxy's error page) is a server fault.
    if (isHtmlPage(text)) reportPage(response, url);
    throw new ApiError(FRIENDLY_MESSAGES.server, response.status, "server");
  }
}

/** Something in front of the API answered with a web page: tell the team (see reportEdgePage). */
function reportPage(response: Response, url: string): void {
  // The host and the route's first two parts ("/api/feed"): enough to group by, with no ids or query.
  const match = /^https?:\/\/([^/?#]+)((?:\/[^/?#]*){0,2})/.exec(url);
  reportEdgePage({
    status: response.status,
    host: match?.[1] ?? "unknown",
    route: match?.[2] || "/",
    server: response.headers.get("server"),
    mitigated: response.headers.get("cf-mitigated"),
    ray: response.headers.get("cf-ray"),
  });
}

/** The API (`EXPO_PUBLIC_API_URL`), signed in. `path` starts with "/", e.g. "/users/me". */
export function apiFetch<T>(user: User, path: string, init?: RequestInitWithJson): Promise<T> {
  return request<T>(`${config().apiUrl}${path}`, user, init);
}

/** The web server's own routes (`EXPO_PUBLIC_WEB_URL`), e.g. "/api/geocode". Signed in with the same token. */
export function webFetch<T>(user: User, path: string, init?: RequestInitWithJson): Promise<T> {
  return request<T>(`${config().webUrl}${path}`, user, init);
}
