import { useQuery } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { NOTIFICATIONS_QUERY_KEY } from "@/core/push/use-push-notifications";
import { listNotifications } from "./notifications-api";

/** The notifications list: one query for the screen and the tab badge, refreshed when a push arrives. */
export function useNotifications() {
  const user = useSignedInUser();
  return useQuery({ queryKey: NOTIFICATIONS_QUERY_KEY, queryFn: () => listNotifications(user), staleTime: 60_000 });
}

/** Unread count for the tab badge; 0 while unknown (never a guess). */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}
