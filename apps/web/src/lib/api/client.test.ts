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
