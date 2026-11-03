import type { ApiPost } from "@myhoodora/api-contract/types";
import { ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { postText } from "@/features/feed/post-parts";
import { alertKind } from "./alert-kinds";
import { groupActiveAlerts } from "./alert-lifecycle";

const MAX_ROWS = 3;

/**
 * Nextdoor's "yellow state", as on the web: active alerts sit at the top of the feed as one compact
 * card, grouped by kind, instead of a wall of posts. The posts themselves stay in the feed.
 */
export function ActiveAlertsCard({ posts, hoodName }: { posts: ApiPost[]; hoodName?: string }) {
  const t = useTheme();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const groups = useMemo(() => groupActiveAlerts(posts, now), [posts, now]);
  if (!groups.length) return null;
  const total = groups.reduce((n, g) => n + g.posts.length, 0);
  const shown = groups.slice(0, MAX_ROWS);
  const hidden = groups.length - shown.length;

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.warning }]}>
      <View style={[styles.top, { backgroundColor: t.colors.warningSoft }]}>
        <View style={[styles.dot, { backgroundColor: t.colors.warning }]} />
        <Text variant="label" style={styles.flex} numberOfLines={1} accessibilityRole="header">
          {total} active alert{total > 1 ? "s" : ""} in {hoodName ?? "your neighbourhood"}
        </Text>
        <Pressable onPress={() => router.push("/alerts")} accessibilityRole="link" hitSlop={10}>
          <Text variant="label" tone="primary">
            See all
          </Text>
        </Pressable>
      </View>
      {shown.map((g, i) => {
        const kind = alertKind(g.category);
        const many = g.posts.length > 1;
        return (
          <Pressable
            key={g.category}
            onPress={() => router.push(many ? `/alerts?type=${g.category}` : `/p/${g.latest._id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${g.urgent ? "Urgent. " : ""}${kind.label}${many ? `, ${g.posts.length} reports` : ""}. ${timeAgo(g.latest.createdAt, now)}: ${postText(g.latest)}`}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderTopColor: t.colors.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
          >
            <View style={[styles.icon, { backgroundColor: t.colors.dangerSoft }]}>
              <kind.Icon size={17} color={t.colors.destructive} />
            </View>
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text variant="label">{kind.label}</Text>
                {many ? (
                  <Text variant="caption" tone="muted">
                    · {g.posts.length} reports
                  </Text>
                ) : null}
                {g.urgent ? (
                  <View style={[styles.urgent, { backgroundColor: t.colors.destructive }]}>
                    <Text style={[styles.urgentText, { color: t.colors.destructiveForeground, fontFamily: t.fonts.bold }]}>Urgent</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {timeAgo(g.latest.createdAt, now)} · {postText(g.latest)}
              </Text>
            </View>
            <ChevronRight size={18} color={t.colors.mutedForeground} />
          </Pressable>
        );
      })}
      {hidden > 0 ? (
        <Pressable onPress={() => router.push("/alerts")} accessibilityRole="link" style={[styles.more, { borderTopColor: t.colors.border }]}>
          <Text variant="label" tone="primary">
            +{hidden} more type{hidden > 1 ? "s" : ""} of alert
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: MIN_TOUCH + 8 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  urgent: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  urgentText: { fontSize: 11, lineHeight: 15 },
  more: { alignItems: "center", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
