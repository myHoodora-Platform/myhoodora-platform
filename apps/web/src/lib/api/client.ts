import type { User } from "firebase/auth";
import { API_BASE_URL } from "./config";

/** A non-2xx response (or network failure) from our API, with a readable message. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 means the request never reached the server. */
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

async function messageFrom(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return text || `Request failed (${response.status})`;
}

/**
 * Authenticated JSON request to the NestJS API. Attaches the Firebase ID
 * token, parses JSON, and turns failures into ApiError.
 */
export async function apiFetch<T>(
  user: User,
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Can't reach myHoodora right now. Check your connection.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await messageFrom(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** User-facing message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
