import { describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, withRetry } from "./client";

describe("withRetry", () => {
  it("retries transient failures, then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("down", 503, "server"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, 1, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never retries client errors or offline", async () => {
    for (const err of [new ApiError("bad", 400, "client"), new ApiError("off", 0, "offline")]) {
      const fn = vi.fn().mockRejectedValue(err);
      await expect(withRetry(fn, 2, 1)).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  // Audit B7: a rate-limited read used to fail at once, showing the limiter's raw message.
  it("when rate-limited, waits as long as the API asked before trying again", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn().mockRejectedValueOnce(new ApiError("slow down", 429, "rate_limited", 3000)).mockResolvedValueOnce("ok");
      const result = withRetry(fn, 1, 1000);
      await vi.advanceTimersByTimeAsync(2900);
      expect(fn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      await expect(result).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("when asked to wait longer than a person would, gives up at once instead of leaving them on a spinner", async () => {
    const err = new ApiError("slow down", 429, "rate_limited", 45_000);
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 2, 1)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const err = new ApiError("slow", 0, "timeout");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 2, 1)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("apiFetch", () => {
  const user = { getIdToken: async () => "token" } as unknown as Parameters<typeof apiFetch>[0];
  const respond = (body: string, status = 200) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));

  it("classifies 401 as an expired session", async () => {
    respond(JSON.stringify({ statusCode: 401, message: "Invalid or expired token" }), 401);
    await expect(apiFetch(user, "/users/me")).rejects.toMatchObject({ kind: "auth", status: 401 });
  });

  // Audit B2: AuthContext signs out of Firebase on kind "auth" and on nothing else. The API answers
  // 503 when it can't reach Firebase to check a sign-in, which must stay a retryable server error.
  it("classifies 503 (the API can't check the sign-in right now) as a retryable server error, not an expired session", async () => {
    respond(JSON.stringify({ statusCode: 503, message: "We can't check your sign-in right now. Please try again in a moment." }), 503);
    const err = await apiFetch(user, "/users/me").catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "server", status: 503 });
    expect((err as ApiError).isRetryable).toBe(true);
  });

  const limited = (body: object, headers: Record<string, string> = {}) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 429, headers })));

  it("classifies the rate limiter's 429 as rate-limited: friendly words, how long to wait, retryable", async () => {
    limited({ statusCode: 429, message: "Too many requests. Please wait a moment and try again." }, { "Retry-After": "12" });
    const err = (await apiFetch(user, "/posts/neighborhood/abc").catch((e: unknown) => e)) as ApiError;
    expect(err).toMatchObject({ kind: "rate_limited", status: 429, retryAfterMs: 12_000, message: "You're doing that a lot. Give it a moment and try again." });
    expect(err.isRetryable).toBe(true);
  });

  it("keeps the API's own words for a 429 that is one of its rules, not the rate limiter (no Retry-After), and doesn't retry it", async () => {
    limited({ statusCode: 429, message: "You can post one urgent alert every 6 hours. Post it as a normal alert instead." });
    const err = (await apiFetch(user, "/posts").catch((e: unknown) => e)) as ApiError;
    expect(err).toMatchObject({ kind: "client", status: 429, message: "You can post one urgent alert every 6 hours. Post it as a normal alert instead." });
    expect(err.retryAfterMs).toBeUndefined();
    expect(err.isRetryable).toBe(false);
  });

  it("keeps the API's message for validation errors", async () => {
    respond(JSON.stringify({ statusCode: 400, message: ["displayName must be longer than or equal to 2 characters"] }), 400);
    await expect(apiFetch(user, "/users/me/onboarding")).rejects.toMatchObject({
      kind: "client",
      message: "displayName must be longer than or equal to 2 characters",
    });
  });

  // Regression: a 200 with an HTML body threw a bare SyntaxError that callers
  // couldn't classify.
  it("turns a non-JSON success body into a server error", async () => {
    respond("<html>oops</html>");
    await expect(apiFetch(user, "/users/me")).rejects.toMatchObject({ kind: "server" });
  });

  it("reports an unreachable server as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch(user, "/users/me")).rejects.toMatchObject({ kind: "network", status: 0 });
  });
});
