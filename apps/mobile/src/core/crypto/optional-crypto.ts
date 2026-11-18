import { requireOptionalNativeModule } from "expo";

type ExpoCrypto = typeof import("expo-crypto");

let loaded: ExpoCrypto | null | undefined;

/**
 * expo-crypto, or null in a build without it. It joined the app after the first Android store builds
 * (1.0.0, version codes 2 and 3), and its JS throws as soon as it's loaded when the native part is
 * missing; a top-level import would crash those phones at launch the moment an update reached them.
 * So, like the calendar: check first, and only then load.
 */
export function optionalCrypto(): ExpoCrypto | null {
  if (loaded === undefined) {
    // A static import would load it in every build; a dynamic import() isn't supported by Jest here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = requireOptionalNativeModule("ExpoCrypto") ? (require("expo-crypto") as ExpoCrypto) : null;
  }
  return loaded;
}

/**
 * A random v4 UUID: expo-crypto's where the build has it, otherwise built from Math.random. Good enough
 * for a local id that only has to differ between phones; never use it for a secret.
 */
export function randomId(): string {
  const crypto = optionalCrypto();
  if (crypto) return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** For tests: forget what was loaded. */
export function resetOptionalCryptoForTests() {
  loaded = undefined;
}
