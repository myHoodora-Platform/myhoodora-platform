import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

vi.mock("./config", () => ({ auth: {} }));
// The live path (vitest otherwise runs in mock mode).
vi.mock("@/lib/api/config", () => ({ API_BASE_URL: "http://api.test/api", USE_MOCKS: false, isLive: () => true }));
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (original) => ({ ...(await original<typeof import("@/lib/api/client")>()), apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const { fetchUserProfile } = await import("./auth");
const user = (uid: string) => ({ uid }) as User;

describe("fetchUserProfile", () => {
  it("shares one request between callers asking at the same moment (sign-in), then asks afresh", async () => {
    let answer!: (v: unknown) => void;
    apiFetch.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    const both = Promise.all([fetchUserProfile(user("ada")), fetchUserProfile(user("ada"))]);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    answer({ uid: "ada", isOnboarded: true });
    expect(await both).toEqual([{ uid: "ada", isOnboarded: true }, { uid: "ada", isOnboarded: true }]);

    apiFetch.mockResolvedValueOnce({ uid: "ada", isOnboarded: true, displayName: "Ada" });
    expect(await fetchUserProfile(user("ada"))).toMatchObject({ displayName: "Ada" });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("never hands one person's profile to another, and doesn't remember a failure", async () => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (u: User) => ({ uid: u.uid }));
    expect(await Promise.all([fetchUserProfile(user("ada")), fetchUserProfile(user("tunde"))])).toEqual([{ uid: "ada" }, { uid: "tunde" }]);
    apiFetch.mockReset();
    apiFetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ uid: "ada" });
    await expect(fetchUserProfile(user("ada"))).rejects.toThrow("offline");
    expect(await fetchUserProfile(user("ada"))).toEqual({ uid: "ada" });
  });
});
