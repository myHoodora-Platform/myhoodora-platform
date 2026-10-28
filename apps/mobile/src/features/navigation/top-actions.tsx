import { Bell, MessageCircle, Search } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useRouter } from "@/core/navigation/use-router";
import { IconButton } from "@/shared/ui/icon-button";
import { useUnreadMessages } from "@/features/chat/use-unread-messages";
import { useUnreadCount } from "@/features/notifications";

/**
 * The same three buttons at the top of every tab: Search, Notifications and Messages, each with its
 * unread count. Messages is one tap from anywhere.
 */
export function TopActions() {
  const router = useRouter();
  const notifications = useUnreadCount();
  const messages = useUnreadMessages();
  return (
    <View style={styles.actions}>
      <IconButton Icon={Search} label="Search" onPress={() => router.push("/search")} />
      <IconButton Icon={Bell} label="Notifications" badge={notifications} onPress={() => router.push("/notifications")} />
      <IconButton Icon={MessageCircle} label="Messages" badge={messages} onPress={() => router.push("/inbox")} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
});
