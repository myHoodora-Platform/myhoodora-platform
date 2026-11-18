import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { randomId } from "@/core/crypto/optional-crypto";

const KEY = "invite.device";
let cached: string | null = null;

/**
 * An id for this phone, sent with invite claims so staff can spot many sign-ups from one phone (the API
 * keeps only a salted one-way hash, never this). Android: the app-scoped Android ID (survives a reinstall,
 * so a reinstall can't fake a new phone). iPhone: the vendor id. Otherwise a random id kept on the phone.
 */
export async function deviceId(): Promise<string | undefined> {
  if (cached) return cached;
  try {
    let id: string | null = null;
    if (Platform.OS === "android") id = Application.getAndroidId();
    else if (Platform.OS === "ios") id = await Application.getIosIdForVendorAsync();
    if (!id) {
      id = await AsyncStorage.getItem(KEY);
      if (!id) {
        id = randomId();
        await AsyncStorage.setItem(KEY, id);
      }
    }
    const clean = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    cached = clean.length >= 8 ? clean : null;
    return cached ?? undefined;
  } catch {
    return undefined;
  }
}
