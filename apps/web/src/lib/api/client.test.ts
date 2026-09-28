import { describe, expect, it, vi } from "vitest";
import { ApiError, withRetry } from "./client";

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
