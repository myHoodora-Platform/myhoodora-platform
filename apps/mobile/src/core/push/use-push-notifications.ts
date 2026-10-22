import type { PushData } from "@myhoodora/api-contract/push";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/core/auth/auth-provider";
import { registerPush } from "./push";
import { routeForHref } from "./push-routes";

// While the app is open, a push still shows as a banner (the in-app list updates too).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Query keys that change when a notification arrives. Features use these same keys. */
export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/**
 * Wires push into the session: registers this phone once someone is signed in and onboarded (only if
 * they already allowed notifications; asking is the feed's job), refreshes the notifications list
 * when one arrives, and opens the right screen when one is tapped, including the tap that launched the app.
 */
export function usePushNotifications() {
  const { phase, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const registeredFor = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "ready" || !user || registeredFor.current === user.uid) return;
    registeredFor.current = user.uid;
    registerPush(user).catch((err: Error) => console.warn(`Push registration failed: ${err.message}`));
  }, [phase, user]);

  useEffect(() => {
    if (!user) registeredFor.current = null;
  }, [user]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    });
    return () => sub.remove();
  }, [queryClient]);

  // Taps, once the person is in the app (a tap on a cold start waits for the session to settle).
  useEffect(() => {
    if (phase !== "ready" || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    const data = lastResponse.notification.request.content.data as Partial<PushData> | undefined;
    router.push(routeForHref(data?.href) as Href);
  }, [phase, lastResponse, router]);
}
