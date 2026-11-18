import { badgeShareText, BUILDER_INVITES } from "@myhoodora/api-contract/invites";
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
import { getEngagement, getInviteSummary, inviteKeys } from "./invites-api";
import { ParticipationBadge } from "@/shared/ui/avatar";
import { badgeLabel, STREAK_TIER_AT } from "@myhoodora/api-contract/engagement";
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
  const whatsapp = () => shareOnWhatsApp(message);
  const copyCode = async () => {
    await Clipboard.setStringAsync(s.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
          <Text variant="caption" tone="muted" style={styles.codeLabel}>
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
        <Challenge invitesFallback={s.verified} link={s.link} hoodName={hoodName} />

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

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const t = useTheme();
  const v = Math.min(value, max);
  return (
    <View style={[styles.track, { backgroundColor: t.colors.border }]} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: v }}>
      <View style={[styles.fill, { width: `${(v / max) * 100}%`, backgroundColor: t.colors.primary }]} />
    </View>
  );
}

/** The launch challenge (plan WP-C): Hood Builder by either path, and the streak. The web's ChallengeProgress. */
/** WhatsApp first (on ~95% of Nigerian phones); the share sheet when it isn't installed. */
async function shareOnWhatsApp(message: string) {
  const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(url).catch(() => false)) await Linking.openURL(url).catch(() => undefined);
  else await Share.share({ message }).catch(() => undefined);
}

function Challenge({ invitesFallback, link, hoodName }: { invitesFallback: number; link: string; hoodName?: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const e = useQuery({ queryKey: inviteKeys.engagement(user.uid), queryFn: () => getEngagement(user), staleTime: 0 }).data;
  const c = e?.challenge;
  const minInvites = c?.minInvites ?? BUILDER_INVITES;
  const invites = c?.invites ?? invitesFallback;
  return (
    <View style={[styles.challenge, { backgroundColor: t.colors.muted }]}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text variant="label">{c?.name ?? "myHoodora Launch Challenge"}</Text>
          <Text variant="caption" tone="muted">
            {c?.builder ? "You're a Hood Builder. Thank you!" : c && !c.active ? "The challenge has ended." : "Become a Hood Builder: either path counts."}
          </Text>
        </View>
        {e?.badge ? <ParticipationBadge badge={e.badge} size={34} /> : null}
      </View>
      <View style={styles.rowBetween}>
        <Text variant="caption" style={styles.flex}>
          Neighbours who joined and verified
        </Text>
        <Text variant="caption" tone="muted">
          {Math.min(invites, minInvites)} of {minInvites}
        </Text>
      </View>
      <Progress value={invites} max={minInvites} label="Verified invites towards Hood Builder" />
      {c ? (
        <>
          <View style={styles.rowBetween}>
            <Text variant="caption" style={styles.flex}>
              Days active
            </Text>
            <Text variant="caption" tone="muted">
              {Math.min(c.activeDays, c.minActiveDays)} of {c.minActiveDays}
            </Text>
          </View>
          <Progress value={c.activeDays} max={c.minActiveDays} label="Active days towards Hood Builder" />
        </>
      ) : null}
      {e?.streak ? (
        <Text variant="caption">
          <Text variant="caption" style={{ fontFamily: t.fonts.semibold }}>
            {e.streak.current}-day streak
          </Text>
          {` · best ${e.streak.best}`}
          {e.streak.toNextTier ? ` · ${e.streak.toNextTier} more to ${e.streak.current >= STREAK_TIER_AT.silver ? "gold" : e.streak.current >= STREAK_TIER_AT.bronze ? "silver" : "bronze"}` : " · gold"}
          {e.streak.activeToday ? " · done for today ✓" : ""}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        A day counts when you post, reply, vote or RSVP; reactions don&apos;t. One missed day a week doesn&apos;t break a streak.
      </Text>
      {/* "Share my badge": its WhatsApp preview is the badge card (the web's /i/<code>/badge), and it's an invite. */}
      {e?.badge && badgeLabel(e.badge) ? (
        <Button label="Share my badge" variant="secondary" onPress={() => void shareOnWhatsApp(badgeShareText(badgeLabel(e.badge)!, hoodName, `${link}/badge`))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  challenge: { borderRadius: 14, padding: 12, gap: 8 },
  body: { paddingHorizontal: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  codeBox: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", alignItems: "center", paddingTop: 16, paddingBottom: 8, gap: 6 },
  codeLabel: { fontSize: 12, letterSpacing: 1.2 },
  // A line tall enough for the 36 pt code (the body's 22 squeezed it), and the letter spacing balanced
  // on the left too: it also follows the last letter, which pulled the code off centre.
  code: { fontSize: 36, lineHeight: 46, letterSpacing: 6, paddingLeft: 6 },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: MIN_TOUCH - 8 },
  center: { textAlign: "center" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  statN: { fontSize: 24, lineHeight: 32 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});
