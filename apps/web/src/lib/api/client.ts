import type { User } from "firebase/auth";
import { ApiError, FRIENDLY_MESSAGES, MAX_RETRY_AFTER_MS, REQUEST_TIMEOUT_MS, errorFor } from "@myhoodora/api-contract/errors";
import { API_BASE_URL } from "./config";

// Classification and wording are shared with the mobile app (packages/api-contract); transport stays here.
export { ApiError, FRIENDLY_MESSAGES, errorKind, errorMessage, type ApiErrorKind } from "@myhoodora/api-contract/errors";

async function errorFrom(response: Response): Promise<ApiError> {
  return errorFor(response.status, await response.text().catch(() => ""), response.headers.get("Retry-After"));
}

/**
 * Authenticated JSON request to the NestJS API. Attaches the Firebase ID
 * token, times out after 15s, and turns every failure into a typed ApiError.
 */
export async function apiFetch<T>(
  user: User,
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(FRIENDLY_MESSAGES.offline, 0, "offline");
  }

  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(FRIENDLY_MESSAGES.timeout, 0, "timeout");
    }
    const kind = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network";
    throw new ApiError(FRIENDLY_MESSAGES[kind], 0, kind);
  }

  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  try {
    return (text ? JSON.parse(text) : undefined) as T;
  } catch {
    // A 2xx that isn't JSON (a proxy's HTML error page, a truncated body) is
    // a server fault, not something the caller should have to special-case.
    throw new ApiError(FRIENDLY_MESSAGES.server, response.status, "server");
  }
}

/**
 * Multipart upload with progress (fetch can't report upload progress, so
 * this uses XHR). Same auth, errors and friendly messages as apiFetch.
 */
export async function apiUpload<T>(
  user: User,
  path: string,
  body: FormData,
  { onProgress, timeoutMs = 120_000 }: { onProgress?: (fraction: number) => void; timeoutMs?: number } = {},
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(FRIENDLY_MESSAGES.offline, 0, "offline");
  }
  const token = await user.getIdToken();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.ontimeout = () => reject(new ApiError(FRIENDLY_MESSAGES.timeout, 0, "timeout"));
    xhr.onerror = () => reject(new ApiError(FRIENDLY_MESSAGES.network, 0, "network"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(errorFor(xhr.status, xhr.responseText, xhr.getResponseHeader("Retry-After")));
      }
      try {
        resolve((xhr.responseText ? JSON.parse(xhr.responseText) : undefined) as T);
      } catch {
        reject(new ApiError(FRIENDLY_MESSAGES.server, xhr.status, "server"));
      }
    };
    xhr.send(body);
  });
}

/**
 * POST to a public (no account) endpoint. Validation (400/422) messages
 * from the API are shown as-is; anything else, including the rate limiter's
 * 429, gets the friendly wording.
 */
export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new ApiError(FRIENDLY_MESSAGES.timeout, 0, "timeout");
    throw new ApiError(FRIENDLY_MESSAGES.network, 0, "network");
  }
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

/**
 * Retry a read once or twice on transient failures (network, timeout, 5xx,
 * the rate limiter), with a short backoff. Never retries other 4xx: those
 * won't fix themselves. When rate-limited it waits as long as the API asked,
 * unless that is longer than someone should be left looking at a spinner.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const retryable = err instanceof ApiError ? err.isRetryable && err.kind !== "offline" : false;
    if (!retryable || retries <= 0) throw err;
    const asked = (err as ApiError).retryAfterMs ?? 0;
    if (asked > MAX_RETRY_AFTER_MS) throw err;
    await new Promise((r) => setTimeout(r, Math.max(delayMs, asked)));
    return withRetry(fn, retries - 1, delayMs * 2);
  }
}
