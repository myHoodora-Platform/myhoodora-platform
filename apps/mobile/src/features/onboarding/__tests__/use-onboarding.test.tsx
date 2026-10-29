import { ApiError } from "@myhoodora/api-contract/errors";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useOnboarding } from "../use-onboarding";

const user = { uid: "u1", displayName: null };
const mockRefreshProfile = jest.fn();
let mockProfile: Record<string, unknown> = { isOnboarded: false };
jest.mock("@/core/auth/auth-provider", () => ({
  useSignedInUser: () => user,
  useAuth: () => ({ profile: mockProfile, refreshProfile: mockRefreshProfile }),
}));

const mockLocation = { currentPosition: jest.fn(), geocode: jest.fn(), reverseGeocode: jest.fn() };
jest.mock("@/core/location/location", () => ({
  currentPosition: (...a: unknown[]) => mockLocation.currentPosition(...a),
  geocode: (...a: unknown[]) => mockLocation.geocode(...a),
  reverseGeocode: (...a: unknown[]) => mockLocation.reverseGeocode(...a),
  POSITION_PROBLEM: { denied: "Location is off for myHoodora.", off: "off", timeout: "timeout", unavailable: "unavailable", approximate: "approximate" },
}));

const mockStore = { readDraft: jest.fn(), saveDraft: jest.fn(), clearDraft: jest.fn(), clearOnboardingSkipped: jest.fn() };
jest.mock("@/core/onboarding/onboarding-store", () => ({
  readDraft: (...a: unknown[]) => mockStore.readDraft(...a),
  saveDraft: (...a: unknown[]) => mockStore.saveDraft(...a),
  clearDraft: (...a: unknown[]) => mockStore.clearDraft(...a),
  clearOnboardingSkipped: (...a: unknown[]) => mockStore.clearOnboardingSkipped(...a),
}));

const mockApi = { completeOnboarding: jest.fn(), previewLocation: jest.fn(), verifyLocation: jest.fn(), requestHood: jest.fn() };
jest.mock("../onboarding-api", () => ({
  completeOnboarding: (...a: unknown[]) => mockApi.completeOnboarding(...a),
  previewLocation: (...a: unknown[]) => mockApi.previewLocation(...a),
  verifyLocation: (...a: unknown[]) => mockApi.verifyLocation(...a),
  requestHood: (...a: unknown[]) => mockApi.requestHood(...a),
}));

const LEKKI = { id: "h1", name: "Lekki Phase 1", city: "Lagos" };
const HOME = { lat: 6.4474, lng: 3.472 };

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { isOnboarded: false };
  mockStore.readDraft.mockResolvedValue(null);
  mockStore.saveDraft.mockResolvedValue(undefined);
  mockStore.clearDraft.mockResolvedValue(undefined);
  mockStore.clearOnboardingSkipped.mockResolvedValue(undefined);
  mockApi.previewLocation.mockResolvedValue({ hood: LEKKI, nearbyHoods: [] });
  mockApi.completeOnboarding.mockResolvedValue({});
  mockApi.verifyLocation.mockResolvedValue({ verificationStatus: "verified", neighborhoodId: "h1" });
  mockRefreshProfile.mockResolvedValue(true);
});

async function started() {
  const hook = await renderHook(() => useOnboarding());
  await waitFor(() => expect(hook.result.current.step).toBe("details"));
  return hook;
}

/** Name and a typed address that the geocoder finds at street level. */
async function typedAndConfirming(precision: "street" | "area" = "street") {
  mockLocation.geocode.mockResolvedValue({ ...HOME, precision });
  const hook = await started();
  await act(async () => {
    hook.result.current.editName("Ada Okafor");
    hook.result.current.editAddress({ street: "12 Admiralty Way", area: "Lekki Phase 1", city: "Lagos" });
  });
  await act(() => hook.result.current.toConfirm());
  expect(hook.result.current.step).toBe("confirm");
  return hook;
}

describe("useOnboarding", () => {
  it("manual entry: finds the address, shows its Hood, saves, then verifies into that Hood", async () => {
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview?.hood?.name).toBe("Lekki Phase 1"));
    await act(() => hook.result.current.confirm());
    expect(mockApi.completeOnboarding).toHaveBeenCalledWith(user, { displayName: "Ada Okafor", address: "12 Admiralty Way, Lekki Phase 1, Lagos", coords: HOME });
    expect(mockApi.verifyLocation).toHaveBeenCalledWith(user, HOME, "h1");
    expect(mockStore.clearDraft).toHaveBeenCalledWith("u1");
    expect(hook.result.current.step).toBe("joined");
    expect(hook.result.current.joinedHood).toBe("Lekki Phase 1");
  });

  it("shows field errors and asks nothing of the API while the form is incomplete", async () => {
    const hook = await started();
    await act(() => hook.result.current.toConfirm());
    expect(hook.result.current.errors).toMatchObject({ name: expect.any(String), street: expect.any(String) });
    expect(mockLocation.geocode).not.toHaveBeenCalled();
    expect(hook.result.current.step).toBe("details");
  });

  it("location denied: says so, and typing the address still works", async () => {
    mockLocation.currentPosition.mockResolvedValue({ ok: false, reason: "denied" });
    const hook = await started();
    await act(() => hook.result.current.locateMe());
    expect(hook.result.current.locate).toEqual({ status: "failed", message: "Location is off for myHoodora." });
    expect(hook.result.current.point).toBeNull();
  });

  it("location granted: fills the address to check, and keeps the GPS point while it's edited", async () => {
    mockLocation.currentPosition.mockResolvedValue({ ok: true, coords: HOME, accuracyM: 25 });
    mockLocation.reverseGeocode.mockResolvedValue({ address: "x", parts: { street: "Admiralty Way", area: "Lekki Phase 1", city: "Lagos" } });
    const hook = await started();
    await act(() => hook.result.current.locateMe());
    expect(hook.result.current.address).toEqual({ street: "Admiralty Way", area: "Lekki Phase 1", city: "Lagos" });
    await act(async () => hook.result.current.editAddress({ street: "12 Admiralty Way" }));
    expect(hook.result.current.point).toEqual({ value: HOME, source: "gps", accuracyM: 25 });
  });

  it("only the area found: no Hood is asked for, and joining is not offered", async () => {
    const hook = await typedAndConfirming("area");
    expect(mockApi.previewLocation).not.toHaveBeenCalled();
    await act(() => hook.result.current.confirm());
    expect(mockApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("a 409 (the point isn't in that Hood) changes nothing and returns to confirm with the reason", async () => {
    mockApi.verifyLocation.mockRejectedValue(new ApiError("That pin is in Ikoyi, not Lekki Phase 1. Check it and confirm again.", 409, "client"));
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    await act(() => hook.result.current.confirm());
    expect(hook.result.current.step).toBe("confirm");
    expect(hook.result.current.problem).toMatch(/Ikoyi/);
  });

  it("a failed check keeps the saved details: 'try again' only checks again", async () => {
    mockApi.verifyLocation.mockRejectedValueOnce(new ApiError("Request timed out", 0, "timeout"));
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    await act(() => hook.result.current.confirm());
    expect(hook.result.current.step).toBe("failed");
    await act(() => hook.result.current.retryCheck());
    expect(hook.result.current.step).toBe("joined");
    expect(mockApi.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(mockApi.verifyLocation).toHaveBeenCalledTimes(2);
  });

  it("a refused save returns to the form with the reason, and everything typed is still there", async () => {
    mockApi.completeOnboarding.mockRejectedValue(new ApiError("displayName must be shorter", 400, "client"));
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    await act(() => hook.result.current.confirm());
    expect(hook.result.current.step).toBe("details");
    expect(hook.result.current.problem).toBe("We couldn't save your details: displayName must be shorter");
    expect(hook.result.current.name).toBe("Ada Okafor");
    expect(mockApi.verifyLocation).not.toHaveBeenCalled();
  });

  it("taps faster than a render still save once", async () => {
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    await act(async () => {
      void hook.result.current.confirm();
      void hook.result.current.confirm();
    });
    await waitFor(() => expect(hook.result.current.step).toBe("joined"));
    expect(mockApi.completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it("outside every Hood but near some: offers them, and sends the request", async () => {
    mockApi.previewLocation.mockResolvedValue({ hood: null, nearbyHoods: [{ id: "h2", name: "Ajah", city: "Lagos", distanceMeters: 800 }] });
    mockApi.verifyLocation.mockResolvedValue({ verificationStatus: "unverified", reason: "outside_coverage", nearbyHoods: [{ id: "h2", name: "Ajah", city: "Lagos", distanceMeters: 800 }] });
    mockApi.requestHood.mockResolvedValue({});
    const hook = await typedAndConfirming();
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    await act(() => hook.result.current.confirm());
    expect(mockApi.verifyLocation).toHaveBeenCalledWith(user, HOME, undefined);
    expect(hook.result.current.step).toBe("nearby");
    expect(hook.result.current.selectedHoodId).toBe("h2");
    await act(() => hook.result.current.requestToJoin());
    expect(mockApi.requestHood).toHaveBeenCalledWith(user, "h2");
    expect(hook.result.current.step).toBe("requested");
  });

  it("resumes from this phone's draft, on the step it reached", async () => {
    mockStore.readDraft.mockResolvedValue({ name: "Ada", address: { street: "1 Bode Thomas", area: "Surulere", city: "Lagos" }, coords: HOME, source: "street", accuracyM: null, step: "confirm" });
    const hook = await renderHook(() => useOnboarding());
    await waitFor(() => expect(hook.result.current.step).toBe("confirm"));
    expect(hook.result.current.name).toBe("Ada");
    await waitFor(() => expect(mockApi.previewLocation).toHaveBeenCalledWith(user, HOME));
  });

  it("without a draft, starts from what an earlier attempt saved on the account", async () => {
    mockProfile = { isOnboarded: true, displayName: "Ada Okafor", location: { address: "12 Admiralty Way, Lekki Phase 1, Lagos", lat: 6.4, lng: 3.4 } };
    const hook = await started();
    expect(hook.result.current.name).toBe("Ada Okafor");
    expect(hook.result.current.address).toEqual({ street: "12 Admiralty Way", area: "Lekki Phase 1", city: "Lagos" });
    expect(hook.result.current.point?.source).toBe("saved");
  });

  it("leaves only once the profile has reloaded, and says so when it can't", async () => {
    const hook = await started();
    mockRefreshProfile.mockResolvedValueOnce(false);
    await act(() => hook.result.current.finish());
    expect(hook.result.current.finished).toBe(false);
    expect(hook.result.current.problem).toMatch(/couldn't load your account/);
    await act(() => hook.result.current.finish());
    expect(hook.result.current.finished).toBe(true);
  });
});
