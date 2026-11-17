import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { rememberInviteRef } from "./invite-ref";

const READ_KEY = "invite.referrerRead";

/** "ref=ADA7K&src=qr" (what our Play Store links pass as `referrer`) → the code and how it came. */
export function parseInstallReferrer(raw: string | null | undefined): { code: string; via: "qr" | "link" } | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Keep it as it came.
  }
  const params = new Map(
    text
      .replace(/^[?&]/, "")
      .split("&")
      .map((p) => p.split("=", 2) as [string, string | undefined]),
  );
  const code = params.get("ref");
  return code ? { code, via: params.get("src") === "qr" ? "qr" : "link" } : null;
}

/**
 * Android, first launch after installing from someone's invite: the Play Store hands over the
 * `referrer` our link gave it, so the code survives the install (plan WP-E). Asked once per install.
 */
export async function readInstallReferrerOnce(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    if (await AsyncStorage.getItem(READ_KEY)) return;
    const found = parseInstallReferrer(await Application.getInstallReferrerAsync());
    if (found) await rememberInviteRef(found.code, found.via);
    await AsyncStorage.setItem(READ_KEY, "1");
  } catch {
    // No Play Store (an emulator, a sideload), or it didn't answer: try again next launch.
  }
}
