import { Bell, MessageCircle, Search } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { IconButton } from "@/shared/ui/icon-button";
import { Text } from "@/shared/ui/text";
import { useUnreadMessages } from "@/features/chat/use-unread-messages";
import { useUnreadCount } from "@/features/notifications";
import { TOUR_TARGETS } from "@/features/tour/home-tour";
import { useTourTarget } from "@/features/tour/tour-provider";

/**
 * The same three buttons at the top of every tab: Search, Notifications and Messages, each with its
 * unread count. Messages is one tap from anywhere.
 */
export function TopActions() {
  const router = useRouter();
  const notifications = useUnreadCount();
  const messages = useUnreadMessages();
  const tourAnchor = useTourTarget(TOUR_TARGETS.topActions);
  return (
    <View ref={tourAnchor} collapsable={false} style={styles.actions}>
      <IconButton Icon={Search} label="Search" onPress={() => router.push("/search")} />
      <IconButton Icon={Bell} label="Notifications" badge={notifications} onPress={() => router.push("/notifications")} />
      <IconButton Icon={MessageCircle} label="Messages" badge={messages} onPress={() => router.push("/inbox")} />
    </View>
  );
}

/** A tab's fixed top row: its big title, and the same buttons as Home, in the same place. */
export function TabHeader({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: t.colors.foreground, fontFamily: t.fonts.bold }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      <TopActions />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 16, paddingRight: 8, minHeight: 56 },
  title: { fontSize: 26, lineHeight: 32, flexShrink: 1 },
});
