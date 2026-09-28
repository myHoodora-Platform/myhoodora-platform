import { describe, expect, it } from "vitest";
import { isGuestOnlyPath, isPublicPath, legacyRedirectFor } from "./routes";
import { safeNextPath } from "./safe-redirect";

const params = (q = "") => new URLSearchParams(q);

describe("legacyRedirectFor", () => {
  it("sends old dashboard URLs to their new homes", () => {
    expect(legacyRedirectFor("/dashboard", params())).toBe("/news-feed");
    expect(legacyRedirectFor("/dashboard/safety-watch", params())).toBe("/alerts");
    expect(legacyRedirectFor("/dashboard/marketplace", params())).toBe("/for-sale");
    expect(legacyRedirectFor("/dashboard/events", params())).toBe("/events");
    expect(legacyRedirectFor("/dashboard/settings/account", params())).toBe("/settings/account");
  });

  it("turns shared ?post= links into post pages", () => {
    expect(legacyRedirectFor("/dashboard", params("post=abc123"))).toBe("/p/abc123");
  });

  it("leaves new routes alone", () => {
    expect(legacyRedirectFor("/news-feed", params())).toBeNull();
    expect(legacyRedirectFor("/p/abc", params())).toBeNull();
  });
});

describe("route access", () => {
  it("treats marketing pages as public and app pages as protected", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/about")).toBe(true);
    expect(isPublicPath("/coming-soon/careers")).toBe(true);
    expect(isPublicPath("/news-feed")).toBe(false);
    expect(isPublicPath("/p/abc")).toBe(false);
    expect(isPublicPath("/coming-soonish")).toBe(false);
  });

  it("knows the guest-only auth pages", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/news-feed")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows in-app deep links", () => {
    expect(safeNextPath("/p/abc")).toBe("/p/abc");
    expect(safeNextPath("/for-sale?filter=free")).toBe("/for-sale?filter=free");
  });

  it("rejects open redirects and non-app targets", () => {
    for (const bad of [null, "", "//evil.com", "https://evil.com", "/\\evil.com", "/login", "/", "/api/auth/session"]) {
      expect(safeNextPath(bad)).toBe("/news-feed");
    }
  });
});
