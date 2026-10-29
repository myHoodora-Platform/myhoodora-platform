import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { reportError } from "@/core/monitoring/monitoring";

/**
 * Where Firebase keeps the signed-in session (its long-lived refresh token): the Keychain on iOS,
 * the Keystore-backed store on Android (ADR-003). Firebase's default for React Native is
 * AsyncStorage, which is not encrypted.
 *
 * SecureStore keys may only contain letters, digits, ".", "-" and "_"; Firebase's look like
 * "firebase:authUser:<key>:[DEFAULT]", so they are encoded. If the platform refuses a value (some
 * Android keystores fail outright), it falls back to AsyncStorage for that key rather than signing
 * the person out on every launch, and says so in the log.
 */
const FALLBACK_PREFIX = "insecure-fallback:";

export function secureKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(secureKey(key)).catch(() => null);
    return value ?? AsyncStorage.getItem(FALLBACK_PREFIX + key);
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(secureKey(key), value);
      await AsyncStorage.removeItem(FALLBACK_PREFIX + key);
    } catch (err) {
      // The error only, never the key's value (it is the session).
      reportError(err, "secure-storage");
      await AsyncStorage.setItem(FALLBACK_PREFIX + key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(secureKey(key)).catch(() => undefined);
    await AsyncStorage.removeItem(FALLBACK_PREFIX + key);
  },
};
