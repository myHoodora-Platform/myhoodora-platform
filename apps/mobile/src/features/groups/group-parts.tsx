import type { Group } from "@myhoodora/api-contract/types";
import { Image } from "expo-image";
import { BadgeCheck, Lock } from "lucide-react-native";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { accent } from "@/shared/theme/accents";
import { useTheme } from "@/shared/theme/theme";
import { sizedImage } from "@/shared/utils/media";
import { Text } from "@/shared/ui/text";
import { GROUP_CATEGORY, groupMeta } from "./groups-api";

/** A group's picture: its cover photo, or its category's icon on the category's colour. */
export function GroupAvatar({ group, size = 56, radius = 16 }: { group: Pick<Group, "coverPhoto" | "category">; size?: number; radius?: number }) {
  const t = useTheme();
  const c = GROUP_CATEGORY[group.category] ?? GROUP_CATEGORY.other;
  const [bg, fg] = accent(c.tone, t.scheme);
  // The category's colour shows while the photo loads (or if it can't).
  if (group.coverPhoto) {
    return <Image source={sizedImage(group.coverPhoto, size)} style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg }} contentFit="cover" transition={150} accessible={false} />;
  }
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <c.Icon size={size * 0.45} color={fg} />
    </View>
  );
}

/** "🔒 Private · 12 members · Safety", with the official tick for estate / residents' association groups. */
export function GroupMetaLine({ group, style }: { group: Group; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.meta, style]}>
      {group.official ? <BadgeCheck size={14} color={t.colors.primary} accessibilityLabel="Official group" /> : null}
      {group.privacy === "private" ? <Lock size={13} color={t.colors.mutedForeground} /> : null}
      <Text variant="caption" tone="muted" numberOfLines={1} style={styles.shrink}>
        {groupMeta(group)} · {(GROUP_CATEGORY[group.category] ?? GROUP_CATEGORY.other).label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  shrink: { flexShrink: 1 },
});
