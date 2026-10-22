import type { AppNotification } from "@myhoodora/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { CheckCheck } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { isAppRoute } from "@/core/push/push-routes";
import { NOTIFICATIONS_QUERY_KEY } from "@/core/push/use-push-notifications";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { IconButton } from "@/shared/ui/icon-button";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { markAllRead, markRead } from "./notifications-api";
import { useNotifications } from "./use-notifications";

function NotificationsList() {
  const insets = useScreenInsets();
  const t = useTheme();
  const user = useSignedInUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useNotifications();
  const pull = usePullRefresh(list.refetch);
  const open = (n: AppNotification) => {
    if (!n.read) {
      // Shown as read at once; the list refetches to confirm.
      queryClient.setQueryData<AppNotification[]>(NOTIFICATIONS_QUERY_KEY, (rows) => rows?.map((r) => (r._id === n._id ? { ...r, read: true } : r)));
      markRead(user, n._id).catch(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }));
    }
    // Screens the app doesn't have yet open on the web, signed in there separately.
    if (isAppRoute(n.href)) router.push(n.href as Href);
    else void WebBrowser.openBrowserAsync(`${config().webUrl}${n.href}`);
  };

  if (list.isPending) return <LoadingState label="Loading notifications" />;
  if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16, flexGrow: 1 }}
      scrollIndicatorInsets={{ top: insets.top }}
      style={{ backgroundColor: t.colors.background }}
      data={list.data}
      keyExtractor={(n) => n._id}
      ListEmptyComponent={<EmptyState title="No notifications yet" body="When neighbours comment, reply or post an alert, you'll see it here." />}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.colors.border }} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}`}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.accent : item.read ? t.colors.background : tint(t.colors.primary, 0.07) }]}
        >
          {!item.read ? <View style={[styles.dot, { backgroundColor: t.colors.primary }]} /> : null}
          <View style={styles.flex}>
            <Text variant="label">{item.title}</Text>
            {item.body ? (
              <Text tone="muted" numberOfLines={2}>
                {item.body}
              </Text>
            ) : null}
            <Text variant="caption" tone="muted">
              {timeAgo(item.createdAt)}
            </Text>
          </View>
        </Pressable>
      )}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

/** `/notifications`. */
export function NotificationsScreen() {
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const list = useNotifications();
  const readAll = useMutation({ mutationFn: () => markAllRead(user), onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }) });
  const unread = list.data?.some((n) => !n.read);
  return (
    <AppScreen
      title="Notifications"
      canvas={false}
      right={unread ? <IconButton Icon={CheckCheck} label="Mark all as read" onPress={() => readAll.mutate()} /> : undefined}
    >
      <NotificationsList />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, padding: 16, minHeight: MIN_TOUCH, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  flex: { flex: 1, gap: 2 },
});
