import { useQuery } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useSupportUnread } from "@/features/support/support-screens";
import { chatKeys, unreadMessages } from "./chat-api";

/** Unread messages across neighbours' conversations and the team's, for the header badge; 0 while unknown. */
export function useUnreadMessages(): number {
  const user = useSignedInUser();
  const { data } = useQuery({ queryKey: chatKeys.unread, queryFn: () => unreadMessages(user), staleTime: 30_000 });
  return (data?.count ?? 0) + useSupportUnread();
}
