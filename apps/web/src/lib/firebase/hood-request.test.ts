import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

// Only the mock branches run here (NEXT_PUBLIC_USE_MOCKS=true in vitest), so
// Firebase itself is never touched.
vi.mock("./config", () => ({ auth: {} }));

const { cancelHoodRequestApi, fetchUserProfile, requestHoodApi, verifyLocationApi } = await import("./auth");

let n = 0;
const newUser = () => ({ uid: `hood-test-${++n}`, email: "qa@example.com", displayName: "QA" }) as unknown as User;

const LEKKI = { lat: 6.4478, lng: 3.4746 };
const NEARBY = { lat: 6.4412, lng: 3.4995 }; // ~2.9 km east of Lekki Phase 1
const FAR = { lat: 9.0765, lng: 7.3986 }; // Abuja

describe("verifyLocationApi (mock)", () => {
  it("verifies an address inside the Hood", async () => {
    const res = await verifyLocationApi(newUser(), LEKKI);
    expect(res.verificationStatus).toBe("verified");
    expect(res.nearbyHoods).toBeUndefined();
  });

  it("offers nearby Hoods, nearest first, when just outside", async () => {
    const res = await verifyLocationApi(newUser(), NEARBY);
    expect(res).toMatchObject({ verificationStatus: "unverified", reason: "outside_coverage" });
    expect(res.nearbyHoods!.length).toBeGreaterThan(0);
    const d = res.nearbyHoods!.map((h) => h.distanceMeters);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(res.nearbyHoods![0]!.name).toBe("Lekki Phase 1");
  });

  it("offers nothing when far from every Hood", async () => {
    const res = await verifyLocationApi(newUser(), FAR);
    expect(res.nearbyHoods).toEqual([]);
  });
});

describe("hood requests (mock)", () => {
  it("requests an offered Hood, then cancels it", async () => {
    const user = newUser();
    const { nearbyHoods } = await verifyLocationApi(user, NEARBY);
    const pending = (await requestHoodApi(user, nearbyHoods![0]!.id)) as Record<string, unknown>;
    expect(pending.verificationStatus).toBe("pending_review");
    expect(pending.requestedHood).toMatchObject({ id: nearbyHoods![0]!.id, name: "Lekki Phase 1" });
    expect(((await fetchUserProfile(user)) as Record<string, unknown>).verificationStatus).toBe("pending_review");

    const cancelled = (await cancelHoodRequestApi(user)) as Record<string, unknown>;
    expect(cancelled).toMatchObject({ verificationStatus: "unverified", requestedHood: null });
  });

  it("refuses a Hood that wasn't offered for your address", async () => {
    const user = newUser();
    await verifyLocationApi(user, FAR);
    await expect(requestHoodApi(user, "mock-lekki-phase-1")).rejects.toMatchObject({ status: 400, kind: "client" });
  });

  it("refuses once you're already verified", async () => {
    const user = newUser();
    await verifyLocationApi(user, LEKKI);
    await expect(requestHoodApi(user, "mock-lekki-phase-1")).rejects.toMatchObject({ status: 409 });
  });

  it("verifying afterwards clears a pending request", async () => {
    const user = newUser();
    const { nearbyHoods } = await verifyLocationApi(user, NEARBY);
    await requestHoodApi(user, nearbyHoods![0]!.id);
    await verifyLocationApi(user, LEKKI);
    expect(await fetchUserProfile(user)).toMatchObject({ verificationStatus: "verified", requestedHood: null });
  });
});
