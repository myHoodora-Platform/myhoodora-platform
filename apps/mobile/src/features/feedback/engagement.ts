import type { User } from "@firebase/auth";
import type { SignalKey } from "@myhoodora/api-contract/prompts";
import * as StoreReview from "expo-store-review";
import { sendSignal } from "./feedback-api";
import { promptStore } from "./prompt-store";

/**
 * Tell the API what the neighbour just did (a post, a sale, opening Search…). Fire and forget: it never
 * slows the action down, and a failure is silent. The API may answer with a feedback prompt (shown
 * after its delay, so it never interrupts the moment) or, at a milestone, a store review.
 */
export function signal(user: User, key: SignalKey, subjectId?: string): void {
  void sendSignal(user, key, subjectId)
    .then(async (res) => {
      if (res.storeReview) {
        // The stores decide whether their card appears (and cap it); nothing is asked first.
        if (await StoreReview.isAvailableAsync().catch(() => false)) await StoreReview.requestReview().catch(() => undefined);
        return;
      }
      const prompt = res.prompt;
      if (prompt) setTimeout(() => promptStore.offer(prompt), Math.max(0, prompt.delaySeconds) * 1000);
    })
    .catch(() => undefined);
}
