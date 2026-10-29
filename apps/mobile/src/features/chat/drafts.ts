import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { registerLogoutCleanup } from "@/core/auth/logout-cleanup";

/**
 * Unsent messages, per chat, kept on this phone (WhatsApp's drafts): leave a chat mid-sentence and
 * the words are there when you come back, with "Draft:" on its row in Messages. Per account, and
 * cleared on logout, since they're private words.
 */
type Drafts = Record<string, string>;

const key = (uid: string) => `chat.drafts.${uid}`;
let owner: string | null = null;
let drafts: Drafts = {};
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Reads this account's drafts once; later calls share it. */
export function loadDrafts(uid: string): Promise<void> {
  if (owner === uid && loading) return loading;
  owner = uid;
  drafts = {};
  loading = AsyncStorage.getItem(key(uid))
    .then((raw) => {
      if (owner !== uid) return;
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      drafts = parsed && typeof parsed === "object" ? (parsed as Drafts) : {};
      emit();
    })
    .catch(() => undefined);
  return loading;
}

export function getDraft(uid: string, conversationId: string): string {
  return owner === uid ? (drafts[conversationId] ?? "") : "";
}

/** Saved a moment after typing stops; blank removes it. */
export function setDraft(uid: string, conversationId: string, text: string): void {
  if (owner !== uid) return;
  const kept = text.trim() ? text : "";
  if ((drafts[conversationId] ?? "") === kept) return;
  drafts = { ...drafts };
  if (kept) drafts[conversationId] = kept;
  else delete drafts[conversationId];
  emit();
  if (saveTimer) clearTimeout(saveTimer);
  const snapshot = drafts;
  saveTimer = setTimeout(() => void AsyncStorage.setItem(key(uid), JSON.stringify(snapshot)).catch(() => undefined), 400);
}

/** On logout: nothing of what was being written stays on the phone. */
export async function clearDrafts(uid: string): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  if (owner === uid) {
    drafts = {};
    emit();
  }
  await AsyncStorage.removeItem(key(uid)).catch(() => undefined);
}

registerLogoutCleanup(clearDrafts);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Every draft of this account, for Messages; re-renders as they change. */
export function useDrafts(uid: string): Drafts {
  const all = useSyncExternalStore(subscribe, () => drafts);
  return owner === uid ? all : {};
}
