import { claimNavigation, NAV_LOCK_MS, resetNavigationLock } from "../use-router";

beforeEach(resetNavigationLock);

describe("claimNavigation", () => {
  it("lets the first tap through and holds the quick repeats", () => {
    expect(claimNavigation(1_000)).toBe(true);
    expect(claimNavigation(1_050)).toBe(false);
    expect(claimNavigation(1_000 + NAV_LOCK_MS - 1)).toBe(false);
  });

  it("opens again once the lock has passed", () => {
    expect(claimNavigation(1_000)).toBe(true);
    expect(claimNavigation(1_000 + NAV_LOCK_MS)).toBe(true);
  });
});
