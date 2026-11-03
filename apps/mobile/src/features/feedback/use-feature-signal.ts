import type { PromptFeature } from "@myhoodora/api-contract/prompts";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { signal } from "./engagement";

/** Counts a visit to a part of the app each time its screen comes into view ("after using Search 3 times"). */
export function useFeatureSignal(feature: PromptFeature): void {
  const user = useSignedInUser();
  useFocusEffect(
    useCallback(() => {
      signal(user, feature);
    }, [user, feature]),
  );
}
