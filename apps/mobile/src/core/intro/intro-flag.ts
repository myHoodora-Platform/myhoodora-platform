import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether this install has shown the intro. App storage (not the Keychain), so it is gone after an
 * uninstall or "Clear data", and the intro shows again: exactly when it should.
 */
const KEY = "intro.seen.v1";

export async function hasSeenIntro(): Promise<boolean> {
  // If storage can't be read, don't trap the person in the intro: treat it as seen.
  return (await AsyncStorage.getItem(KEY).catch(() => "1")) === "1";
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1").catch(() => undefined);
}

/** Show the intro again on the next launch (the welcome screen's preview button, outside production). */
export async function resetIntro(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
