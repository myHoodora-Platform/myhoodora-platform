import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllOnboardingDrafts } from "@/features/onboarding/draft";
import { HOME_TOUR_ID, noteTourEligibility, readTourStatus, writeTourStatus } from "./storage";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const status = (uid: string) => readTourStatus(HOME_TOUR_ID, uid);

describe("tour eligibility", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("queues the tour for someone first seen before verification", () => {
    noteTourEligibility("new", { isOnboarded: false, verificationStatus: "unverified" });
    expect(status("new")).toBe("pending");
  });

  it("leaves existing members (first seen already verified) alone", () => {
    noteTourEligibility("old", { isOnboarded: true, verificationStatus: "verified" });
    expect(status("old")).toBeNull();
  });

  it("never queues it for staff", () => {
    noteTourEligibility("mod", { isOnboarded: false, verificationStatus: "unverified", role: "moderator" });
    expect(status("mod")).toBeNull();
  });

  it("keeps pending through verification, and never re-queues a finished tour", () => {
    noteTourEligibility("u", { isOnboarded: false });
    noteTourEligibility("u", { isOnboarded: true, verificationStatus: "verified" });
    expect(status("u")).toBe("pending");

    writeTourStatus(HOME_TOUR_ID, "u", "skipped");
    noteTourEligibility("u", { isOnboarded: true, verificationStatus: "unverified" });
    expect(status("u")).toBe("skipped");
  });

  it("is per account and survives the sign-out clean-up", () => {
    writeTourStatus(HOME_TOUR_ID, "a", "completed");
    clearAllOnboardingDrafts();
    expect(status("a")).toBe("completed");
    expect(status("b")).toBeNull();
  });

  it("ignores unknown stored values and missing storage", () => {
    localStorage.setItem(`myhoodora:tour:${HOME_TOUR_ID}:x`, "garbage");
    expect(status("x")).toBeNull();
    vi.stubGlobal("localStorage", undefined);
    expect(status("x")).toBeNull();
    expect(() => writeTourStatus(HOME_TOUR_ID, "x", "started")).not.toThrow();
  });
});
