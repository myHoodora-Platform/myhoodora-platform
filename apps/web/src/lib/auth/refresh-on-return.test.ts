import { describe, expect, it } from "vitest";
import { RETURN_REFRESH_MS, returnRefreshDue } from "./refresh-on-return";

describe("returnRefreshDue", () => {
  it("reloads the profile on return, at most once per window", () => {
    expect(returnRefreshDue(true, 0, RETURN_REFRESH_MS)).toBe(true);
    expect(returnRefreshDue(true, 1_000, 1_000 + RETURN_REFRESH_MS - 1)).toBe(false);
    expect(returnRefreshDue(true, 1_000, 1_000 + RETURN_REFRESH_MS)).toBe(true);
  });

  it("does nothing when signed out", () => {
    expect(returnRefreshDue(false, 0, 10 * RETURN_REFRESH_MS)).toBe(false);
  });
});
