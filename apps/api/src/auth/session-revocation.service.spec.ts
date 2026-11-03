import type { ConfigService } from "@nestjs/config";
import { RevocationLookupUnavailable, SessionRevocationService } from "./session-revocation.service";

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

  const firebaseIsDown = () => getUser.mockRejectedValue(Object.assign(new Error("network"), { code: "app/network-error" }));

  it("if Firebase can't be reached about someone unknown, the lookup fails as 'unavailable' (never 'fine', never 'revoked'), and nothing is remembered", async () => {
    const service = make();
    getUser.mockRejectedValueOnce(Object.assign(new Error("network"), { code: "auth/internal-error" }));
    const failure = await service.isRevoked(signedInAt(NOW)).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(RevocationLookupUnavailable);
    expect((failure as RevocationLookupUnavailable).reason).toBe("auth/internal-error");
    firebaseSays({});
    expect(await service.isRevoked(signedInAt(NOW))).toBe(false);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("during an outage, the last answer about someone is reused, whatever it was", async () => {
    firebaseSays({ revokedAtMs: NOW - 60_000 });
    const service = make(30_000);
    const before = signedInAt(NOW - 120_000);
    const after = signedInAt(NOW - 10_000);
    expect(await service.isRevoked(before)).toBe(true);

    firebaseIsDown();
    jest.setSystemTime(NOW + 31_000); // the 30-second window has passed, so Firebase is asked again and fails
    expect(await service.isRevoked(after)).toBe(false);
    // "Revoked" survives the outage just as "not revoked" does: an old answer is reused, not softened.
    expect(await service.isRevoked(before)).toBe(true);
  });

  it("…but only for five minutes after Firebase last answered; then it is 'unavailable' until Firebase is back", async () => {
    firebaseSays({});
    const service = make(30_000);
    await service.isRevoked(signedInAt(NOW));

    firebaseIsDown();
    jest.setSystemTime(NOW + 4 * 60_000 + 59_000);
    expect(await service.isRevoked(signedInAt(NOW))).toBe(false);
    jest.setSystemTime(NOW + 5 * 60_000 + 11_000);
    await expect(service.isRevoked(signedInAt(NOW))).rejects.toBeInstanceOf(RevocationLookupUnavailable);

    firebaseSays({});
    expect(await service.isRevoked(signedInAt(NOW))).toBe(false);
  });

  it("an outage doesn't mean a lookup (and a timeout) per request: Firebase is retried every 10 seconds per person", async () => {
    firebaseSays({});
    const service = make(30_000);
    await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(1);

    firebaseIsDown();
    jest.setSystemTime(NOW + 31_000);
    for (let i = 0; i < 10; i++) await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(2);
    jest.setSystemTime(NOW + 42_000);
    for (let i = 0; i < 10; i++) await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(3);

    // Back up: the next retry gets a real answer, and the normal 30-second window resumes.
    firebaseSays({ disabled: true });
    jest.setSystemTime(NOW + 53_000);
    expect(await service.isRevoked(signedInAt(NOW))).toBe(true);
    expect(getUser).toHaveBeenCalledTimes(4);
  });

  it("nothing is reused for someone we were told to forget (they just signed out everywhere), or when nothing is remembered at all", async () => {
    firebaseSays({});
    const service = make(30_000);
    await service.isRevoked(signedInAt(NOW));
    service.forget("ada");
    firebaseIsDown();
    await expect(service.isRevoked(signedInAt(NOW))).rejects.toBeInstanceOf(RevocationLookupUnavailable);

    firebaseSays({});
    const askEveryTime = make(0);
    await askEveryTime.isRevoked(signedInAt(NOW));
    firebaseIsDown();
    await expect(askEveryTime.isRevoked(signedInAt(NOW))).rejects.toBeInstanceOf(RevocationLookupUnavailable);
  });

  it("a window of 0 asks every time (the old behaviour)", async () => {
    firebaseSays({});
    const service = make(0);
    await service.isRevoked(signedInAt(NOW));
    await service.isRevoked(signedInAt(NOW));
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
