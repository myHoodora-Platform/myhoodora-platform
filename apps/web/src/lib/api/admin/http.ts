import type { User } from "firebase/auth";
import { ApiError, FRIENDLY_MESSAGES, apiFetch, withRetry } from "../client";
import { latency } from "../mock/store";
import type { ListQuery } from "./types";
import type { Actor } from "./mock-db";

/** `?q=…&page=…` from a query object, skipping empty values. */
export function qs(query: object = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "" && v !== "all") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** live: GET /admin{path}{?query}. Reads retry once on transient failures. */
export function adminGet<T>(user: User, path: string, query?: ListQuery | object): Promise<T> {
  return withRetry(() => apiFetch<T>(user, `/admin${path}${qs(query)}`));
}

/** live: POST|PATCH /admin{path}. Mutations never retry automatically. */
export function adminSend<T>(user: User, path: string, json: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return apiFetch<T>(user, `/admin${path}`, { method, json });
}

/** Mock round-trip with the same latency/offline behaviour as the real client. */
export async function mock<T>(fn: () => T, ms = 250): Promise<T> {
  await latency(ms);
  return fn();
}

export function notFound(what: string): never {
  throw new ApiError(`${what} not found.`, 404, "not_found");
}

export function forbidden(): never {
  throw new ApiError(FRIENDLY_MESSAGES.forbidden, 403, "forbidden");
}

export function actorOf(user: User, role: string): Actor {
  return { uid: user.uid, displayName: user.displayName ?? user.email?.split("@")[0] ?? "Staff", role };
}
