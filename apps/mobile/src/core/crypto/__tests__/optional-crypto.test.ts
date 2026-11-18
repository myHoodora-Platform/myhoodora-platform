import { optionalCrypto, randomId, resetOptionalCryptoForTests } from "../optional-crypto";
const mockNative = jest.fn();
jest.mock("expo", () => ({ requireOptionalNativeModule: (name: string) => mockNative(name) }));
const mockLoaded = jest.fn();
jest.mock("expo-crypto", () => {
  mockLoaded();
  return { randomUUID: () => "from-expo-crypto" };
});

beforeEach(() => {
  jest.clearAllMocks();
  resetOptionalCryptoForTests();
});

describe("optionalCrypto", () => {
  it("never loads expo-crypto in a build without it (Android 1.0.0, version codes 2 and 3)", () => {
    mockNative.mockReturnValue(null);
    expect(optionalCrypto()).toBeNull();
    expect(mockNative).toHaveBeenCalledWith("ExpoCrypto");
    expect(mockLoaded).not.toHaveBeenCalled();
  });

  it("loads it once where the build has it", () => {
    mockNative.mockReturnValue({});
    expect(optionalCrypto()?.randomUUID()).toBe("from-expo-crypto");
    optionalCrypto();
    expect(mockNative).toHaveBeenCalledTimes(1);
  });
});

describe("randomId", () => {
  it("uses expo-crypto when it's there", () => {
    mockNative.mockReturnValue({});
    expect(randomId()).toBe("from-expo-crypto");
  });

  it("otherwise makes a well-formed, different v4 UUID each time", () => {
    mockNative.mockReturnValue(null);
    const ids = new Set(Array.from({ length: 200 }, () => randomId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

