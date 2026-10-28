import type { LucideIcon } from "lucide-react-native";
import { Bookmark, ChevronRight, HelpCircle, LifeBuoy, Settings, ShieldCheck, ShoppingBag } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Href } from "expo-router";
import { useAuth } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { accent, type AccentName } from "@/shared/theme/accents";
import { useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { ConnectionStrip } from "@/shared/ui/connection-strip";
import { useTabBarSpace } from "@/shared/ui/floating-tab-bar";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Text } from "@/shared/ui/text";
import { openWeb } from "@/shared/utils/open-web";
import { TabHeader } from "./top-actions";

export interface Shortcut {
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: AccentName;
  href: Href;
}

/** The tiles, in the order neighbours reach for them. Features add theirs here as they're built. */
export const SHORTCUTS: Shortcut[] = [
  { label: "Saved", hint: "Posts to come back to", Icon: Bookmark, tone: "rose", href: "/saved" },
  { label: "Your listings", hint: "What you're selling", Icon: ShoppingBag, tone: "amber", href: "/more" },
  { label: "Support", hint: "Talk to our team", Icon: LifeBuoy, tone: "slate", href: "/inbox/support" },
];

/**
 * The Menu tab (Facebook's and Nextdoor's): you at the top, then a grid of everything that isn't a
 * tab (groups, events, saved posts…), then settings and help. The top bar is the same as Home's.
 */
export function MenuScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const bottom = useTabBarSpace();
  const verified = profile?.verificationStatus === "verified";

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.canvas }]} edges={["top"]}>
      <ConnectionStrip style={styles.connection} />
      <TabHeader title="Menu" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]} scrollIndicatorInsets={{ bottom }}>
        <Card onPress={() => router.push("/more")} label={`${profile?.displayName ?? "Your profile"}. View your profile`}>
          <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={52} />
          <View style={styles.flex}>
            <View style={styles.inline}>
              <Text variant="heading" numberOfLines={1} style={styles.shrink}>
                {profile?.displayName ?? "Neighbour"}
              </Text>
              {verified ? <ShieldCheck size={17} color={t.colors.success} accessibilityLabel="Verified neighbour" /> : null}
            </View>
            <Text variant="caption" tone="muted">
              View your profile
            </Text>
          </View>
          <ChevronRight size={20} color={t.colors.mutedForeground} />
        </Card>

        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <Tile key={s.label} shortcut={s} onPress={() => router.push(s.href)} />
          ))}
        </View>

        <SettingsGroup>
          <SettingsRow Icon={Settings} label="Settings & privacy" onPress={() => router.push("/settings")} />
          <SettingsRow Icon={HelpCircle} label="Help centre" description="Answers to common questions" onPress={() => void openWeb("/help")} />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderColor: t.colors.border }]}
    >
      {children}
    </Pressable>
  );
}

function Tile({ shortcut: s, onPress }: { shortcut: Shortcut; onPress: () => void }) {
  const t = useTheme();
  const [bg, fg] = accent(s.tone, t.scheme);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.label}. ${s.hint}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderColor: t.colors.border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <s.Icon size={20} color={fg} />
      </View>
      <Text variant="label" numberOfLines={1}>
        {s.label}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {s.hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  connection: { marginHorizontal: 16 },
  content: { padding: 16, gap: 20 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47.8%", gap: 4, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
});
