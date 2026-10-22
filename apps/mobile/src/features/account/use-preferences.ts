import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Preferences } from "@myhoodora/api-contract/settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useToast } from "@/shared/ui/toast";
import { accountKeys, getPreferences, updatePreferences } from "./account-api";

/** Merge a change into the preferences the way the API will, to show it before the API answers. */
export function mergePrefs(current: Preferences, patch: DeepPartial<Preferences>): Preferences {
  const notifications = { ...current.notifications };
  for (const [k, v] of Object.entries(patch.notifications ?? {})) {
    const key = k as keyof Preferences["notifications"];
    notifications[key] = { ...notifications[key], ...v };
  }
  return { notifications, digest: patch.digest ?? current.digest, privacy: { ...current.privacy, ...patch.privacy } };
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Notification and privacy settings. Each switch saves at once (no Save button to forget); it moves
 * immediately, and moves back with a message if the API refuses.
 */
export function usePreferences() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const prefs = useQuery({ queryKey: accountKeys.preferences, queryFn: () => getPreferences(user) });
  const save = useMutation({
    mutationFn: (patch: DeepPartial<Preferences>) => updatePreferences(user, patch),
    onMutate: (patch) => {
      const before = client.getQueryData<Preferences>(accountKeys.preferences);
      if (before) client.setQueryData(accountKeys.preferences, mergePrefs(before, patch));
      return { before };
    },
    onError: (err, _patch, context) => {
      if (context?.before) client.setQueryData(accountKeys.preferences, context.before);
      toast(`Not saved: ${errorMessage(err)}`, "error");
    },
    onSuccess: (fresh) => client.setQueryData(accountKeys.preferences, fresh),
  });
  return { prefs, change: (patch: DeepPartial<Preferences>) => save.mutate(patch) };
}
