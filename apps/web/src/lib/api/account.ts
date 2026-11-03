import type { User } from "firebase/auth";
import { apiFetch, ApiError, FRIENDLY_MESSAGES } from "./client";
import { API_BASE_URL, isLive } from "./config";
import { latency } from "./mock/store";

/**
 * live: POST /auth/email-verification/confirm { token } → 204.
 * Public (the link may be opened on another device, signed out). The API
 * answers every bad, used or expired token with the same generic 400.
 */
export async function confirmEmail(token: string): Promise<void> {
  if (!isLive("auth.emailVerification")) {
    await latency(400);
    if (token.length < 20) throw new ApiError("This link is invalid or has expired. Request a new one from the app.", 400, "client");
    return;
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/email-verification/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(FRIENDLY_MESSAGES.network, 0, "network");
  }
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  const message =
    response.status === 429
      ? "Too many attempts. Wait a moment and try again."
      : (body?.message ?? "This link is invalid or has expired. Request a new one from the app.");
  throw new ApiError(message, response.status, "client");
}

/** live: POST /auth/email-verification/resend → 202 (429 after 3 links an hour). */
export async function resendVerificationEmail(user: User): Promise<void> {
  if (!isLive("auth.emailVerification")) {
    await latency(300);
    return;
  }
  await apiFetch<void>(user, "/auth/email-verification/resend", { method: "POST" });
}
