import type { AvatarBadge } from "@myhoodora/api-contract/engagement";
import { useQuery } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { getEngagement, inviteKeys } from "./invites-api";

/** Your own participation badge (contract §42), for your own avatar, as neighbours see it on your posts. */
export function useMyBadge(enabled = true): AvatarBadge | null | undefined {
  const user = useSignedInUser();
  return useQuery({ queryKey: inviteKeys.engagement(user.uid), queryFn: () => getEngagement(user), enabled, staleTime: 5 * 60_000 }).data?.badge;
}
