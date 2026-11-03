import type { User } from "firebase/auth";
import { ApiError, FRIENDLY_MESSAGES } from "@/lib/api/client";

/**
 * Keeps the server session (the HttpOnly cookie the proxy reads) in step
 * with Firebase's sign-in state in this browser. The one place that talks
 * to /api/auth/session and /api/auth/logout.
 *
 * - ok: the cookie is in place; protected pages will load.
 * - rejected: the server refused this sign-in (expired, revoked, disabled).
 * - unavailable: we couldn't find out (offline, API down). Try again later.
 */
export type SessionSync = "ok" | "rejected" | "unavailable";

const TIMEOUT_MS = 15_000;

async function postIdToken(user: User, forceRefresh: boolean): Promise<SessionSync> {
  const idToken = await user.getIdToken(forceRefresh);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return "ok";
  return res.status === 401 ? "rejected" : "unavailable";
}

async function sync(user: User): Promise<SessionSync> {
  try {
    const first = await postIdToken(user, false);
    if (first !== "rejected") return first;
  } catch {
    return "unavailable";
  }
  // A cached token can be refused for being seconds too old. Ask Firebase for
  // a new one: if the session really is over, that fails (or is refused again).
  try {
    return await postIdToken(user, true);
  } catch (err) {
    return (err as { code?: string }).code === "auth/network-request-failed" ? "unavailable" : "rejected";
  }
}

// AuthProvider, the sign-in forms and the redirect hooks can all ask at the
// same moment (and so can a token refresh): they share one request.
let syncing: { uid: string; result: Promise<SessionSync> } | null = null;

export function syncServerSession(user: User): Promise<SessionSync> {
  if (syncing?.uid === user.uid) return syncing.result;
  const result = sync(user).finally(() => {
    if (syncing?.result === result) syncing = null;
  });
  syncing = { uid: user.uid, result };
  return result;
}

/**
 * For the sign-in and sign-up forms: resolves once protected pages will
 * load for this person, so the navigation that follows can't be bounced
 * back to login. Throws a readable ApiError otherwise.
 */
export async function requireServerSession(user: User): Promise<void> {
  const result = await syncServerSession(user);
  if (result === "rejected") throw new ApiError(FRIENDLY_MESSAGES.auth, 401, "auth");
  if (result === "unavailable") throw new ApiError(FRIENDLY_MESSAGES.network, 0, "network");
}

let clearing: Promise<void> | null = null;

/** Ends the server session in this browser. Never throws: Firebase has already signed out. */
export function clearServerSession(): Promise<void> {
  clearing ??= fetch("/api/auth/logout", { method: "POST" })
    .then(() => undefined)
    .catch((err) => console.error("Failed to clear the session cookie:", err))
    .finally(() => {
      clearing = null;
    });
  return clearing;
}
