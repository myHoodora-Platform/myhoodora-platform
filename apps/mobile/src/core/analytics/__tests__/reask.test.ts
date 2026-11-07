import { ANALYTICS_POLICY_VERSION, shouldAskAnalytics } from "@myhoodora/api-contract/app-config";
import { findLegalVersion } from "@myhoodora/api-contract/legal";

const now = new Date("2027-06-01T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
const no = (d: number, policy = ANALYTICS_POLICY_VERSION) => ({ choice: "denied" as const, at: daysAgo(d), policy });
const yes = (d: number, policy = ANALYTICS_POLICY_VERSION) => ({ choice: "granted" as const, at: daysAgo(d), policy });

describe("shouldAskAnalytics", () => {
  it("asks when this phone has never answered", () => {
    expect(shouldAskAnalytics(null, 0, now)).toBe(true);
  });

  it("asks again after a no once the admin's days have passed, not before", () => {
    expect(shouldAskAnalytics(no(179), 180, now)).toBe(false);
    expect(shouldAskAnalytics(no(180), 180, now)).toBe(true);
    expect(shouldAskAnalytics(no(31), 30, now)).toBe(true);
  });

  it("never asks again after a no when the admin set 0 (and while the setting hasn't loaded)", () => {
    expect(shouldAskAnalytics(no(1000), 0, now)).toBe(false);
  });

  it("never asks again after a yes for time alone", () => {
    expect(shouldAskAnalytics(yes(1000), 30, now)).toBe(false);
  });

  it("asks everyone again when the privacy policy changes analytics", () => {
    expect(shouldAskAnalytics(yes(1, "2026-11-03"), 180, now)).toBe(true);
    expect(shouldAskAnalytics(no(1, "2026-11-03"), 0, now)).toBe(true);
  });

  it("treats a broken date as recent", () => {
    expect(shouldAskAnalytics({ choice: "denied", at: "not a date", policy: ANALYTICS_POLICY_VERSION }, 1, now)).toBe(false);
  });
});

describe("ANALYTICS_POLICY_VERSION", () => {
  it("is a published Privacy Policy version", () => {
    expect(findLegalVersion("privacy", ANALYTICS_POLICY_VERSION)).toBeDefined();
  });
});
