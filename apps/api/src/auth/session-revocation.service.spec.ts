import type { ConfigService } from "@nestjs/config";
import { SessionRevocationService } from "./session-revocation.service";

const getUser = jest.fn();
jest.mock("../config/firebase.config", () => ({ getFirebaseAdmin: () => ({ auth: () => ({ getUser: (uid: string) => getUser(uid) }) }) }));

const make = (ttlMs = 30_000) => new SessionRevocationService({ get: () => ttlMs } as unknown as ConfigService);
const NOW = 1_800_000_000_000;
const signedInAt = (ms: number) => ({ uid: "ada", auth_time: Math.floor(ms / 1000) });
const firebaseSays = (state: { revokedAtMs?: number; disabled?: boolean }) =>
  getUser.mockResolvedValue({ uid: "ada", disabled: state.disabled ?? false, tokensValidAfterTime: state.revokedAtMs ? new Date(state.revokedAtMs).toUTCString() : undefined });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  getUser.mockReset();
});
afterEach(() => jest.useRealTimers());

describe("SessionRevocationService", () => {
  it("a sign-in from before the last revocation is revoked; one from after it is not", async () => {
    firebaseSays({ revokedAtMs: NOW - 60_000 });
    const service = make();
    expect(await service.isRevoked(signedInAt(NOW - 120_000))).toBe(true);
    expect(await service.isRevoked(signedInAt(NOW - 10_000))).toBe(false);
    // The same second counts as "after", exactly as in the Admin SDK.
    expect(await service.isRevoked(signedInAt(NOW - 60_000))).toBe(false);
  });

  it("never revoked means never revoked; disabled or deleted means everything is", async () => {
    firebaseSays({});
    expect(await make().isRevoked(signedInAt(NOW - 86_400_000))).toBe(false);
    firebaseSays({ disabled: true });
    expect(await make().isRevoked(signedInAt(NOW))).toBe(true);
    getUser.mockRejectedValue(Object.assign(new Error("gone"), { code: "auth/user-not-found" }));
    expect(await make().isRevoked(signedInAt(NOW))).toBe(true);
  });

  it("asks Firebase once per user per window, however many requests arrive", async () => {
    firebaseSays({});
    const service = make(30_000);
    await Promise.all(Array.from({ length: 8 }, () => service.isRevoked(signedInAt(NOW))));
    for (let i = 0; i < 20; i++) await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(1);

    jest.setSystemTime(NOW + 29_000);
    await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(1);
    jest.setSystemTime(NOW + 31_000);
    await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("a revocation made in Firebase is seen once the window has passed, or at once after forget()", async () => {
    firebaseSays({});
    const service = make(30_000);
    const token = signedInAt(NOW - 5_000);
    expect(await service.isRevoked(token)).toBe(false);

    firebaseSays({ revokedAtMs: NOW });
    expect(await service.isRevoked(token)).toBe(false); // still inside the window
    service.forget("ada");
    expect(await service.isRevoked(token)).toBe(true);

    firebaseSays({});
    jest.setSystemTime(NOW + 31_000);
    expect(await service.isRevoked(token)).toBe(false);
  });

  it("keeps each person's state separate", async () => {
    getUser.mockImplementation(async (uid: string) => ({ uid, disabled: uid === "banned" }));
    const service = make();
    expect(await service.isRevoked({ uid: "banned", auth_time: NOW / 1000 })).toBe(true);
    expect(await service.isRevoked({ uid: "ada", auth_time: NOW / 1000 })).toBe(false);
  });

  it("if Firebase can't be reached, the request fails rather than being waved through, and nothing is remembered", async () => {
    const service = make();
    getUser.mockRejectedValueOnce(Object.assign(new Error("network"), { code: "auth/internal-error" }));
    await expect(service.isRevoked(signedInAt(NOW))).rejects.toThrow("network");
    firebaseSays({});
    expect(await service.isRevoked(signedInAt(NOW))).toBe(false);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("a window of 0 asks every time (the old behaviour)", async () => {
    firebaseSays({});
    const service = make(0);
    await service.isRevoked(signedInAt(NOW));
    await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
