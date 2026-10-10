import type { User } from "firebase/auth";
import { API_BASE_URL } from "./config";

/** What went wrong, so each screen can say something specific and offer the right fix. */
export type ApiErrorKind =
  | "offline" // the device has no connection
  | "timeout" // the request took too long (slow network)
  | "network" // the server couldn't be reached
  | "auth" // 401: session expired
  | "forbidden" // 403
  | "not_found" // 404
  | "server" // 5xx
  | "rate_limited" // 429 from the rate limiter: too many requests, try again shortly
  | "client"; // other 4xx (validation etc.) — message comes from the API

/** A non-2xx response (or network failure) from our API, with a readable message. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 means the request never got a response. */
    readonly status: number,
    readonly kind: ApiErrorKind,
    /** Rate-limited only: how long the API asked us to wait before trying again. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError() {
    return this.kind === "offline" || this.kind === "timeout" || this.kind === "network";
  }

  /** Worth retrying automatically (transient). */
  get isRetryable() {
    return this.isNetworkError || this.kind === "server" || this.kind === "rate_limited";
  }
}

export const FRIENDLY_MESSAGES: Record<ApiErrorKind, string> = {
  offline: "You're offline. Check your connection and try again.",
  timeout: "This is taking longer than usual. Your connection may be slow. Try again.",
  network: "We can't reach myHoodora right now. Try again in a moment.",
  auth: "Your session has expired. Please log in again.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find what you were looking for.",
  server: "Something went wrong on our side. Please try again in a moment.",
  rate_limited: "You're doing that a lot. Give it a moment and try again.",
  client: "That didn't work. Please check and try again.",
};

const REQUEST_TIMEOUT_MS = 15_000;
/** The longest withRetry will wait because the API said so; asked to wait longer, it gives up and says why. */
const MAX_RETRY_AFTER_MS = 10_000;

/**
 * The API's rate limiter says how long to wait (Retry-After, in seconds). That header is also what
 * tells its 429 from the API's own rules that use the same status and carry a message worth showing
 * ("You can post one urgent alert every 6 hours"): those have no Retry-After and stay "client".
 */
function retryAfterMs(status: number, header: string | null): number | undefined {
  if (status !== 429 || header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
}

function kindForStatus(status: number, rateLimited = false): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  if (rateLimited) return "rate_limited";
  return "client";
}

/** The typed error for a non-2xx response, given its body text and Retry-After header. */
function errorFor(status: number, text: string, retryAfterHeader: string | null): ApiError {
  const wait = retryAfterMs(status, retryAfterHeader);
  const kind = kindForStatus(status, wait !== undefined);
  return new ApiError(messageFromText(text, kind), status, kind, wait);
}

async function errorFrom(response: Response): Promise<ApiError> {
  return errorFor(response.status, await response.text().catch(() => ""), response.headers.get("Retry-After"));
}

/**
 * A 403/404 whose message the API wrote for people ("Ada has restricted who can message them…")
 * rather than the framework's stock "Forbidden resource" / "Cannot GET /x".
 */
function customMessage(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { message?: unknown; error?: unknown };
    const message = body.message;
    if (typeof message !== "string" || !message || message === body.error) return undefined;
    if (message === "Forbidden resource" || message.startsWith("Cannot ")) return undefined;
    return message;
  } catch {
    return undefined;
  }
}

function messageFromText(text: string, kind: ApiErrorKind): string {
  if (kind === "forbidden" || kind === "not_found") return customMessage(text) ?? FRIENDLY_MESSAGES[kind];
  // Only validation-style errors carry a message worth showing verbatim.
  if (kind !== "client") return FRIENDLY_MESSAGES[kind];
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // Not JSON — fall through.
  }
  return text || FRIENDLY_MESSAGES.client;
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

/** User-facing message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function errorKind(err: unknown): ApiErrorKind | null {
  return err instanceof ApiError ? err.kind : null;
}
