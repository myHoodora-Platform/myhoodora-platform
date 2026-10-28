import type { Prompt } from "@myhoodora/api-contract/prompts";
import { useSyncExternalStore } from "react";

/**
 * The prompt waiting to be shown (one at a time). Sheet and dialog prompts are shown by PromptHost;
 * feed prompts by the feed, as a card at the top until answered or closed.
 */
let current: Prompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const promptStore = {
  offer(prompt: Prompt) {
    // One at a time: a prompt already waiting isn't replaced.
    if (current) return;
    current = prompt;
    emit();
  },
  clear(id?: string) {
    if (id && current?._id !== id) return;
    current = null;
    emit();
  },
  get: () => current,
};

export function useCurrentPrompt(): Prompt | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
