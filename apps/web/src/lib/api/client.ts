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
  | "client"; // other 4xx (validation etc.) — message comes from the API

/** A non-2xx response (or network failure) from our API, with a readable message. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 means the request never got a response. */
    readonly status: number,
    readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError() {
    return this.kind === "offline" || this.kind === "timeout" || this.kind === "network";
  }

  /** Worth retrying automatically (transient). */
  get isRetryable() {
    return this.isNetworkError || this.kind === "server";
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
  client: "That didn't work. Please check and try again.",
};

const REQUEST_TIMEOUT_MS = 15_000;

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  return "client";
}

async function messageFrom(response: Response, kind: ApiErrorKind): Promise<string> {
  // Only validation-style errors carry a message worth showing verbatim.
  if (kind !== "client") return FRIENDLY_MESSAGES[kind];
  const text = await response.text().catch(() => "");
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

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    throw new ApiError(await messageFrom(response, kind), response.status, kind);
  }
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
 * POST to a public (no account) endpoint. Validation (400/422) and rate
 * limit (429) messages from the API are shown as-is; anything else gets
 * the friendly wording.
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
  if (!res.ok) {
    const kind = kindForStatus(res.status);
    throw new ApiError(await messageFrom(res, kind), res.status, kind);
  }
  return (await res.json()) as T;
}

/**
 * Retry a read once or twice on transient failures (network, timeout, 5xx),
 * with a short backoff. Never retries 4xx — those won't fix themselves.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const retryable = err instanceof ApiError ? err.isRetryable && err.kind !== "offline" : false;
    if (!retryable || retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
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
