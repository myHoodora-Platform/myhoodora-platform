import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Who you blocked, by name, kept on this phone. The API only lists blocked uids, and a blocked
 * person's profile answers 404 (never say who blocked whom), so the name is remembered at the moment
 * of blocking. Someone blocked elsewhere (the web, another phone) shows as "A neighbour you blocked".
 */
const KEY = "blocked.names.v1";

export type BlockedName = { name: string; photoURL?: string | null };

export async function blockedNames(): Promise<Record<string, BlockedName>> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, BlockedName>;
  } catch {
    return {};
  }
}

export async function rememberBlocked(uid: string, who: BlockedName): Promise<void> {
  const all = await blockedNames();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [uid]: who })).catch(() => undefined);
}

export async function forgetBlocked(uid: string): Promise<void> {
  const { [uid]: _gone, ...rest } = await blockedNames();
  await AsyncStorage.setItem(KEY, JSON.stringify(rest)).catch(() => undefined);
}
