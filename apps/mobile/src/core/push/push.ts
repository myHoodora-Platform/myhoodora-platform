import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@firebase/auth";
import type { PushPlatform, RegisterPushDeviceInput } from "@myhoodora/api-contract/push";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "@/core/api/client";

/**
 * Push registration (docs/api-contract.md §30). The API stores one row per phone; logging out here
 * removes it, signing out everywhere removes them all.
 */
const TOKEN_KEY = "push.token";
export const ANDROID_CHANNEL = "default";

export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";

/** Simulators, emulators without Play services and Expo Go can't receive remote pushes. */
function supported(): boolean {
  return Device.isDevice && (Platform.OS === "ios" || Platform.OS === "android");
}

export async function pushPermission(): Promise<PushPermission> {
  if (!supported()) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/** Asks the system once. iOS never shows the prompt again after "Don't Allow": the app sends people to Settings. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!supported()) return "unsupported";
  if (Platform.OS === "android") {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Neighbourhood updates",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/**
 * Registers this phone for the signed-in person, if they have allowed notifications. Safe to call on
 * every launch: the API treats it as "still here". Never prompts.
 */
export async function registerPush(user: User): Promise<"registered" | PushPermission> {
  const permission = await pushPermission();
  if (permission !== "granted") return permission;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const body: RegisterPushDeviceInput = { token, platform: Platform.OS as PushPlatform };
  await apiFetch<void>(user, "/push/devices", { method: "PUT", json: body });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return "registered";
}

/** Logout on this phone. The API only removes it if it belongs to this person. */
export async function unregisterPush(user: User): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await apiFetch<void>(user, `/push/devices/${encodeURIComponent(token)}`, { method: "DELETE" });
  await AsyncStorage.removeItem(TOKEN_KEY);
}
