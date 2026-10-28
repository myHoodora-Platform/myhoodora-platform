import type { User } from "@firebase/auth";
import type { Prompt, PromptAnswer, SignalKey, SignalResult } from "@myhoodora/api-contract/prompts";
import { apiFetch } from "@/core/api/client";

/** Something the neighbour just did (contract §33): the API may answer with a prompt or a store review. */
export function sendSignal(user: User, key: SignalKey, subjectId?: string): Promise<SignalResult> {
  return apiFetch(user, "/engagement/signal", { method: "POST", json: { key, subjectId } });
}

/** One prompt, opened from a notification. */
export function getPrompt(user: User, id: string): Promise<Prompt> {
  return apiFetch(user, `/prompts/${id}`);
}

export function markShown(user: User, id: string): Promise<unknown> {
  return apiFetch(user, `/prompts/${id}/shown`, { method: "POST" });
}

export function markDismissed(user: User, id: string): Promise<unknown> {
  return apiFetch(user, `/prompts/${id}/dismiss`, { method: "POST" });
}

export function answerPrompt(user: User, id: string, answer: PromptAnswer): Promise<{ thanks: string }> {
  return apiFetch(user, `/prompts/${id}/respond`, { method: "POST", json: answer });
}
