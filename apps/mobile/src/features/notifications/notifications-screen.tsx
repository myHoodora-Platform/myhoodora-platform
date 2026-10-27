import type { AppNotification } from "@myhoodora/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href } from "expo-router";
import { useRouter } from "@/core/navigation/use-router";
import { Image } from "expo-image";
import { BadgeCheck, CalendarDays, CheckCheck, Heart, Megaphone, MessageCircle, Send, ShieldCheck, TriangleAlert, Users, type LucideIcon } from "lucide-react-native";
import { memo, useCallback, useMemo } from "react";
import * as WebBrowser from "expo-web-browser";
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from "react-native";
import type { ColorTokens } from "@myhoodora/design-tokens";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { isAppRoute } from "@/core/push/push-routes";
import { NOTIFICATIONS_QUERY_KEY } from "@/core/push/use-push-notifications";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { IconButton } from "@/shared/ui/icon-button";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { sectionNotifications, shortAge, titleParts } from "./notification-rows";
import { markAllRead, markRead } from "./notifications-api";
import { useNotifications } from "./use-notifications";

/** What kind of thing happened, shown as a small badge on the faces (or alone when nobody did it). */
const TYPE_ICON: Record<AppNotification["type"], { Icon: LucideIcon; color: (c: ColorTokens) => string }> = {
  reaction: { Icon: Heart, color: (c) => c.destructive },
  comment: { Icon: MessageCircle, color: (c) => c.info },
  message: { Icon: Send, color: (c) => c.primary },
  alert: { Icon: TriangleAlert, color: (c) => c.warning },
  event: { Icon: CalendarDays, color: (c) => c.primary },
  group: { Icon: Users, color: (c) => c.info },
  verification: { Icon: BadgeCheck, color: (c) => c.success },
  moderation: { Icon: ShieldCheck, color: (c) => c.mutedForeground },
  system: { Icon: Megaphone, color: (c) => c.primary },
};

const FACES = 48;

/** One face, two overlapping faces (latest in front) or, with nobody behind it, the type's icon. */
function Faces({ n, background }: { n: AppNotification; background: string }) {
  const t = useTheme();
  const kind = TYPE_ICON[n.type] ?? TYPE_ICON.system;
  const [latest, second] = n.actors ?? [];
  if (!latest) {
    return (
      <View style={[styles.faces, styles.center, { borderRadius: FACES / 2, backgroundColor: tint(kind.color(t.colors), 0.14) }]}>
        <kind.Icon size={22} color={kind.color(t.colors)} />
      </View>
    );
  }
  const ring = { borderColor: background, borderWidth: 2, borderRadius: 999 };
  return (
    <View style={styles.faces}>
      {second ? (
        <>
          <View style={styles.backFace}>
            <Avatar name={second.displayName} photoURL={second.photoURL} size={34} />
          </View>
          <View style={[styles.frontFace, ring]}>
            <Avatar name={latest.displayName} photoURL={latest.photoURL} size={34} />
          </View>
        </>
      ) : (
        <Avatar name={latest.displayName} photoURL={latest.photoURL} size={FACES} />
      )}
      <View style={[styles.badge, ring, { backgroundColor: kind.color(t.colors) }]}>
        <kind.Icon size={10} color="#fff" strokeWidth={2.5} />
      </View>
    </View>
  );
}

const NotificationRow = memo(function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const t = useTheme();
  const { names, rest } = titleParts(n);
  const age = shortAge(n.createdAt);
  const background = n.read ? t.colors.background : tint(t.colors.primary, 0.07);
  return (
    <Pressable
      onPress={() => onOpen(n)}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}${n.body ? `. ${n.body}` : ""}. ${age}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.accent : background }]}
    >
      <Faces n={n} background={background} />
      <View style={styles.flex}>
        <Text numberOfLines={3}>
          {names ? <Text variant="label" style={styles.inline}>{names}</Text> : null}
          {rest}
          {n.body ? <Text tone="muted">{`: ${n.body}`}</Text> : null}
          <Text tone="muted">{`  ${age}`}</Text>
        </Text>
      </View>
      {n.preview ? (
        <Image source={n.preview.image} style={[styles.thumb, { backgroundColor: t.colors.muted }]} contentFit="cover" recyclingKey={n._id} accessibilityIgnoresInvertColors />
      ) : n.type === "message" ? (
        // The whole row opens the conversation; the button says so.
        <View style={[styles.action, { backgroundColor: t.colors.primary }]}>
          <Text variant="label" tone="inverse">Reply</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function NotificationsList() {
  const insets = useScreenInsets();
  const t = useTheme();
  const user = useSignedInUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useNotifications();
  const pull = usePullRefresh(list.refetch);
  const sections = useMemo(() => sectionNotifications(list.data ?? []), [list.data]);
  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read) {
        // Shown as read at once; the list refetches to confirm.
        queryClient.setQueryData<AppNotification[]>(NOTIFICATIONS_QUERY_KEY, (rows) => rows?.map((r) => (r._id === n._id ? { ...r, read: true } : r)));
        markRead(user, n._id).catch(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }));
      }
      // Screens the app doesn't have yet open on the web, signed in there separately.
      if (isAppRoute(n.href)) router.push(n.href as Href);
      else void WebBrowser.openBrowserAsync(`${config().webUrl}${n.href}`);
    },
    [queryClient, router, user],
  );

  if (list.isPending) return <LoadingState label="Loading notifications" />;
  if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <SectionList
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16, flexGrow: 1 }}
      scrollIndicatorInsets={{ top: insets.top }}
      style={{ backgroundColor: t.colors.background }}
      sections={sections}
      keyExtractor={(n) => n._id}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={<EmptyState title="No notifications yet" body="When neighbours comment, reply or post an alert, you'll see it here." />}
      renderSectionHeader={({ section }) => (
        <Text variant="heading" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => <NotificationRow n={item} onOpen={open} />}
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
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: MIN_TOUCH, alignItems: "center" },
  flex: { flex: 1 },
  inline: { fontSize: 16, lineHeight: 22 },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  faces: { width: FACES, height: FACES },
  center: { alignItems: "center", justifyContent: "center" },
  backFace: { position: "absolute", top: 0, right: 0 },
  frontFace: { position: "absolute", bottom: -2, left: -2 },
  badge: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  thumb: { width: 44, height: 44, borderRadius: 6 },
  action: { paddingHorizontal: 14, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
