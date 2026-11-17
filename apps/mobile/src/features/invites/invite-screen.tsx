import { BUILDER_INVITES } from "@myhoodora/api-contract/invites";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { config } from "@/core/config/env";
import { Check, Copy, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys, getHood } from "@/features/feed/feed-api";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { getInviteSummary, inviteKeys } from "./invites-api";
import { rememberMyInviteCode } from "@/core/invites/invite-ref";

/**
 * `/invite` (the web's Invite neighbours, plan WP-E): your code and link, WhatsApp first, how many
 * joined and verified (only verified count, towards Hood Builder), and who. Nobody's address.
 */
export function InviteScreen() {
  return (
    <AppScreen title="Invite neighbours" fallback="/menu">
      <Body />
    </AppScreen>
  );
}

function Body() {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const homeId = profile?.neighborhoodId ?? "";
  const hood = useQuery({ queryKey: feedKeys.hoodName(homeId), queryFn: () => getHood(user, homeId), enabled: !!homeId, staleTime: Infinity });
  const summary = useQuery({
    queryKey: inviteKeys.me(user.uid),
    queryFn: async () => {
      const s = await getInviteSummary(user);
      await rememberMyInviteCode(s.code);
      return s;
    },
    staleTime: 0,
  });
  const pull = usePullRefresh(() => summary.refetch());
  const [copied, setCopied] = useState(false);
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 };

  if (summary.isPending) {
    return (
      <View style={[styles.body, pad]} accessible accessibilityLabel="Loading your invites">
        <Skeleton height={220} radius={20} />
        <Skeleton height={160} radius={20} />
      </View>
    );
  }
  if (!summary.data) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} title="Couldn't load your invites" />;

  const s = summary.data;
  const hoodName = hood.data?.name;
  const message = `Join me on myHoodora${hoodName ? `, the app for ${hoodName}` : ""}: safety alerts, trusted recommendations and things for sale near us. ${s.link}\n\nMy invite code: ${s.code}`;
  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    // WhatsApp first (on ~95% of Nigerian phones); the share sheet when it isn't installed.
    if (await Linking.canOpenURL(url).catch(() => false)) await Linking.openURL(url).catch(() => undefined);
    else await Share.share({ message }).catch(() => undefined);
  };
  const copyCode = async () => {
    await Clipboard.setStringAsync(s.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const counted = Math.min(s.verified, BUILDER_INVITES);
  const toBuilder = BUILDER_INVITES - counted;

  return (
    <ScrollView
      contentContainerStyle={[styles.body, pad]}
      scrollIndicatorInsets={{ top: insets.top }}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    >
      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: tint(t.colors.primary, 0.12) }]}>
            <UserPlus size={22} color={t.colors.primary} />
          </View>
          <Text tone="muted" style={styles.flex}>
            {hoodName ? `Help ${hoodName} come alive.` : "Bring your neighbours in."} Everyone who joins with your code counts once they verify their address.
          </Text>
        </View>

        <View style={[styles.codeBox, { borderColor: tint(t.colors.primary, 0.4), backgroundColor: tint(t.colors.primary, 0.06) }]}>
          <Text variant="caption" tone="muted">
            YOUR INVITE CODE
          </Text>
          <Text style={[styles.code, { fontFamily: t.fonts.bold }]} selectable accessibilityLabel={`Your invite code: ${s.code.split("").join(" ")}`}>
            {s.code}
          </Text>
          <Pressable onPress={() => void copyCode()} accessibilityRole="button" hitSlop={8} style={styles.copy}>
            {copied ? <Check size={16} color={t.colors.primary} /> : <Copy size={16} color={t.colors.primary} />}
            <Text variant="label" tone="primary">
              {copied ? "Copied" : "Copy code"}
            </Text>
          </Pressable>
        </View>

        <Button label="Invite on WhatsApp" onPress={() => void whatsapp()} />
        <Button label="More ways to share" variant="secondary" onPress={() => void Share.share({ message }).catch(() => undefined)} />
        <Button
          label="Print a QR poster"
          variant="ghost"
          accessibilityHint="Opens your poster in the browser, to print or save as PDF for the estate gate or a notice board"
          onPress={() => void WebBrowser.openBrowserAsync(`${config().webUrl}/i/${s.code}/poster`).catch(() => undefined)}
        />
        <Text variant="caption" tone="muted" style={styles.center}>
          Posts you share carry your code too, so they count as invites.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Text variant="heading">Your neighbours</Text>
        <View style={styles.stats}>
          {(
            [
              ["Joined", s.joined],
              ["Verified", s.verified],
              [hoodName ? `In ${hoodName}` : "In your Hood", s.verifiedInMyHood],
            ] as const
          ).map(([label, n]) => (
            <View key={label} style={[styles.stat, { backgroundColor: t.colors.muted }]}>
              <Text style={[styles.statN, { fontFamily: t.fonts.bold }]}>{n}</Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text variant="label">Hood Builder</Text>
          <Text variant="caption" tone="muted">
            {counted} of {BUILDER_INVITES} verified
          </Text>
        </View>
        <View
          style={[styles.track, { backgroundColor: t.colors.muted }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Verified invites towards Hood Builder"
          accessibilityValue={{ min: 0, max: BUILDER_INVITES, now: counted }}
        >
          <View style={[styles.fill, { width: `${(counted / BUILDER_INVITES) * 100}%`, backgroundColor: t.colors.primary }]} />
        </View>
        <Text variant="caption" tone="muted">
          {toBuilder ? `${toBuilder} more verified ${toBuilder === 1 ? "neighbour" : "neighbours"} to become a Hood Builder in the launch challenge.` : "You've reached Hood Builder. Thank you for building up your neighbourhood!"}
        </Text>

        {s.people.length ? (
          s.people.map((p, i) => (
            <View key={`${p.name}-${p.joinedAt}-${i}`} style={[styles.person, { borderTopColor: t.colors.border }]}>
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  Joined {timeAgo(p.joinedAt)}
                  {p.hoodName ? ` · ${p.hoodName}` : ""}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: p.verified ? tint(t.colors.primary, 0.12) : t.colors.muted }]}>
                <Text variant="caption" tone={p.verified ? "primary" : "muted"}>
                  {p.verified ? "Verified" : "Verifying"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text tone="muted">Nobody yet. Send your link on your estate or street WhatsApp group: that&apos;s where most neighbours join from.</Text>
        )}
        {s.invitedBy ? (
          <Text variant="caption" tone="muted">
            You were invited by {s.invitedBy.name}.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flex: { flex: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  codeBox: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", alignItems: "center", paddingVertical: 14, gap: 4 },
  code: { fontSize: 36, letterSpacing: 8 },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: MIN_TOUCH - 8 },
  center: { textAlign: "center" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  statN: { fontSize: 24 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});
