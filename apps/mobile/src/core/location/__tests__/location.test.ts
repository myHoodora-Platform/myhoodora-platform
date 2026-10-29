import * as Location from "expo-location";
import { currentPosition, POSITION_TIMEOUT_MS } from "../location";

jest.mock("@/core/api/client", () => ({ webFetch: jest.fn() }));
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const fix = (accuracy: number | null) => ({ coords: { latitude: 6.4, longitude: 3.4, accuracy }, timestamp: 0 }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  loc.hasServicesEnabledAsync.mockResolvedValue(true);
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
  loc.getCurrentPositionAsync.mockResolvedValue(fix(20));
});

describe("currentPosition", () => {
  it("returns the fix and how far off it may be", async () => {
    await expect(currentPosition()).resolves.toEqual({ ok: true, coords: { lat: 6.4, lng: 3.4 }, accuracyM: 20 });
  });

  it("says when Location Services are off, without asking for permission", async () => {
    loc.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(currentPosition()).resolves.toEqual({ ok: false, reason: "off" });
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("says when permission is refused", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" } as never);
    await expect(currentPosition()).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("refuses an approximate location: kilometres can't tell which street", async () => {
    loc.getCurrentPositionAsync.mockResolvedValue(fix(3000));
    await expect(currentPosition()).resolves.toEqual({ ok: false, reason: "approximate" });
  });

  it("gives up after the web's 15 seconds instead of spinning forever", async () => {
    jest.useFakeTimers();
    loc.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
    const result = currentPosition();
    await jest.advanceTimersByTimeAsync(POSITION_TIMEOUT_MS);
    await expect(result).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("a GPS failure is 'unavailable'", async () => {
    loc.getCurrentPositionAsync.mockRejectedValue(new Error("kCLErrorLocationUnknown"));
    await expect(currentPosition()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
