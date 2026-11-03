import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { parseProfile, toApiError } from "./profile";

describe("parseProfile", () => {
  it("accepts a profile with an isOnboarded flag", () => {
    expect(parseProfile({ uid: "u1", isOnboarded: true })).toEqual({ uid: "u1", isOnboarded: true });
    expect(parseProfile({ isOnboarded: false }).isOnboarded).toBe(false);
  });

  // Regression: a failed/garbled /users/me used to become `profile = null`,
  // which the app read as "not onboarded" and sent verified users to onboarding.
  it("treats anything else as a server error, never as a new account", () => {
    for (const bad of [null, undefined, "<html>oops</html>", {}, { isOnboarded: "false" }, []]) {
      const err = (() => {
        try {
          parseProfile(bad);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).kind).toBe("server");
    }
  });
});

describe("toApiError", () => {
  it("passes ApiErrors through so 401s stay recognisable", () => {
    const err = new ApiError("expired", 401, "auth");
    expect(toApiError(err)).toBe(err);
  });

  it("wraps unknown failures as server errors", () => {
    expect(toApiError(new SyntaxError("Unexpected token <")).kind).toBe("server");
    expect(toApiError("boom").kind).toBe("server");
  });
});
