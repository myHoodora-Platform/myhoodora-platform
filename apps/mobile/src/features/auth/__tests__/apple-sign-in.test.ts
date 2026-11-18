import { signInWithApple } from "../auth-api";

const mockAppleSignIn = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockUpdateProfile = jest.fn();
const mockCredential = jest.fn((opts: unknown) => ({ provider: "apple.com", opts }));

jest.mock("expo-apple-authentication", () => ({
  signInAsync: (...a: unknown[]) => mockAppleSignIn(...a),
  formatFullName: (n: { givenName?: string; familyName?: string }) => [n.givenName, n.familyName].filter(Boolean).join(" "),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
// The build has expo-crypto (iPhone builds from 16 Nov on).
jest.mock("expo", () => ({ requireOptionalNativeModule: (name: string) => (name === "ExpoCrypto" ? {} : null) }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "raw-nonce",
  digestStringAsync: async (_alg: string, data: string) => `sha256(${data})`,
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
jest.mock("@firebase/auth", () => ({
  OAuthProvider: jest.fn().mockImplementation(() => ({ credential: (o: unknown) => mockCredential(o) })),
  signInWithCredential: (...a: unknown[]) => mockSignInWithCredential(...a),
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
  GoogleAuthProvider: { credential: jest.fn() },
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));
jest.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: {}, isErrorWithCode: () => false, isSuccessResponse: () => false, statusCodes: {} }));
jest.mock("@/core/firebase/auth", () => ({ firebaseAuth: () => "auth" }));
jest.mock("@/core/config/env", () => ({ config: () => ({ google: {} }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateProfile.mockResolvedValue(undefined);
});

describe("signInWithApple", () => {
  it("sends Apple the hashed nonce and Firebase the raw one, then saves the name Apple gives the first time", async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: "apple-id-token", fullName: { givenName: "Dami", familyName: "Okoro" } });
    mockSignInWithCredential.mockResolvedValue({ user: { displayName: null } });

    await expect(signInWithApple()).resolves.toBe(true);
    expect(mockAppleSignIn).toHaveBeenCalledWith(expect.objectContaining({ nonce: "sha256(raw-nonce)", requestedScopes: [0, 1] }));
    expect(mockCredential).toHaveBeenCalledWith({ idToken: "apple-id-token", rawNonce: "raw-nonce" });
    expect(mockSignInWithCredential).toHaveBeenCalledWith("auth", expect.objectContaining({ provider: "apple.com" }));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: null }, { displayName: "Dami Okoro" });
  });

  it("keeps an existing name, and works when Apple sends none (every later sign-in)", async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: "t", fullName: null });
    mockSignInWithCredential.mockResolvedValue({ user: { displayName: "Dami Okoro" } });
    await expect(signInWithApple()).resolves.toBe(true);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("closing Apple's sheet is not an error", async () => {
    mockAppleSignIn.mockRejectedValue(Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }));
    await expect(signInWithApple()).resolves.toBe(false);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it("fails clearly when Apple returns no token", async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: null, fullName: null });
    await expect(signInWithApple()).rejects.toThrow("Apple didn't return a sign-in token.");
  });
});

describe("signInWithApple in a build without expo-crypto", () => {
  it("says to update, before opening Apple's sheet", async () => {
    jest.resetModules();
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => null }));
    const { signInWithApple: signIn } = jest.requireActual<typeof import("../auth-api")>("../auth-api");
    await expect(signIn()).rejects.toThrow("Sign in with Apple needs the latest version of the app.");
    expect(mockAppleSignIn).not.toHaveBeenCalled();
  });
});
