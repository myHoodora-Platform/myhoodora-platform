/**
 * How every API failure is classified and worded, on the web and in the mobile app alike
 * (docs/api-contract.md §0). Transport (fetch, XHR, timeouts) stays in each app; this is the part
 * that must read the same everywhere.
 */

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

/** Every request to the API gives up after this long. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** The longest a client waits because the API said so; asked to wait longer, it gives up and says why. */
export const MAX_RETRY_AFTER_MS = 10_000;

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

/**
 * A web page where our API's JSON should be: something in front of the API answered (Render while it
 * restarts, Cloudflare's "Just a moment…" check), not the API. Whatever its status, it says nothing
 * about the request or the session.
 */
function isHtmlPage(text: string): boolean {
  return /^\s*<(!doctype|html|head|body)\b/i.test(text);
}

/** The typed error for a non-2xx response, given its body text and Retry-After header. */
export function errorFor(status: number, text: string, retryAfterHeader: string | null): ApiError {
  // Never show the page (it was shown word for word once), and never sign anyone out over it: we
  // couldn't reach myHoodora, which is worth trying again.
  if (isHtmlPage(text)) return new ApiError(FRIENDLY_MESSAGES.network, status, "network");
  const wait = retryAfterMs(status, retryAfterHeader);
  const kind = kindForStatus(status, wait !== undefined);
  return new ApiError(messageFromText(text, kind), status, kind, wait);
}

/** A failure with no response at all (offline, timeout, unreachable), in the shared wording. */
export function transportError(kind: "offline" | "timeout" | "network"): ApiError {
  return new ApiError(FRIENDLY_MESSAGES[kind], 0, kind);
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
  // Plain words only, and short: anything else isn't a message written for people.
  return text && text.length <= 200 && !text.includes("<") ? text : FRIENDLY_MESSAGES.client;
}

/** User-facing message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function errorKind(err: unknown): ApiErrorKind | null {
  return err instanceof ApiError ? err.kind : null;
}
