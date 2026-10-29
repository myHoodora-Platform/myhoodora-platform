import { ApiError } from "@myhoodora/api-contract/errors";
import { retryDelay, shouldRetry } from "../query-client";

describe("read retries (the web's withRetry rules)", () => {
  it("retries a transient failure once", () => {
    for (const kind of ["network", "timeout", "server"] as const) {
      const err = new ApiError("x", 0, kind);
      expect(shouldRetry(0, err)).toBe(true);
      expect(shouldRetry(1, err)).toBe(false);
    }
  });

  it("never retries offline, auth, validation or not-found", () => {
    for (const kind of ["offline", "auth", "client", "not_found", "forbidden"] as const) expect(shouldRetry(0, new ApiError("x", 400, kind))).toBe(false);
    expect(shouldRetry(0, new Error("boom"))).toBe(false);
  });

  it("waits as long as the rate limiter asks, unless that is too long to keep a spinner up", () => {
    expect(shouldRetry(0, new ApiError("x", 429, "rate_limited", 3000))).toBe(true);
    expect(retryDelay(0, new ApiError("x", 429, "rate_limited", 3000))).toBe(3000);
    expect(shouldRetry(0, new ApiError("x", 429, "rate_limited", 60_000))).toBe(false);
  });
});
