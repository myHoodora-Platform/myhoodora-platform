import { errorMessage } from "@myhoodora/api-contract/errors";
import type { LeadCase, LeadVote } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Gavel } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { openWeb } from "@/shared/utils/open-web";
import { timeAgo } from "@/shared/utils/time";
import { SeeMoreText } from "@/features/feed/see-more-text";
import { REASON_LABEL, VOTES, afterVote, caseText, getLeadQueue, getLeadStatus, hoursLeft, moderationKeys, voteOnCase } from "./moderation-api";

/**
 * `/leads` (the web's Hood Lead reviews, Nextdoor's model): volunteer neighbours vote on what was
 * reported in their neighbourhood. Three votes with a two-thirds majority decide; otherwise the team
 * does after 48 hours. Leads never see who reported, and never review their own posts.
 */
export function LeadsScreen() {
  return (
    <AppScreen title="Hood Lead reviews" fallback="/menu">
      <Queue />
    </AppScreen>
  );
}

function Queue() {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const status = useQuery({ queryKey: moderationKeys.leadStatus, queryFn: () => getLeadStatus(user) });
  const isLead = status.data?.isLead === true;
  const queue = useQuery({ queryKey: moderationKeys.queue, queryFn: () => getLeadQueue(user), enabled: isLead, staleTime: 0 });
  const pull = usePullRefresh(async () => {
    await Promise.all([status.refetch(), isLead ? queue.refetch() : null]);
  });
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 };

  if (status.isPending || (isLead && queue.isPending)) {
    return (
      <View style={[styles.list, pad]} accessible accessibilityLabel="Loading reports">
        <Skeleton height={90} radius={20} />
        <Skeleton height={180} radius={20} />
        <Skeleton height={180} radius={20} />
      </View>
    );
  }
  if (!status.data) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  if (!isLead) {
    return <EmptyState title="Hood Leads only" body="Hood Leads are volunteer neighbours who help review reports. The myHoodora team appoints them." />;
  }
  if (!queue.data) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} title="Couldn't load reports" />;

  return (
    <FlatList
      data={queue.data}
      keyExtractor={(c) => c.id}
      contentContainerStyle={[styles.list, pad]}
      scrollIndicatorInsets={{ top: insets.top }}
      ListHeaderComponent={<Guidance />}
      renderItem={({ item }) => <CaseCard item={item} />}
      ListEmptyComponent={<EmptyState title="All caught up" body="No reports are waiting in your neighbourhood. Thank you for looking out for your neighbours." />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

function Guidance() {
  const t = useTheme();
  return (
    <View style={[styles.guide, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Gavel size={20} color={t.colors.primary} />
      <View style={styles.flex}>
        <Text variant="caption">
          Judge each item against the community guidelines, not whether you agree with it. Three votes with a two-thirds majority decide; if Leads can&apos;t agree within 48 hours,
          our team decides. You never see who reported it.
        </Text>
        <Pressable onPress={() => void openWeb("/guidelines")} accessibilityRole="link" hitSlop={8}>
          <Text variant="label" tone="primary">
            Read the community guidelines
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CaseCard({ item }: { item: LeadCase }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const text = caseText(item);

  const vote = async (v: LeadVote) => {
    if (busy || item.myVote === v) return;
    setBusy(true);
    try {
      const res = await voteOnCase(user, item.id, v);
      client.setQueryData<LeadCase[]>(moderationKeys.queue, (cases) => (cases ? afterVote(cases, item.id, v, res.decided) : cases));
      void client.invalidateQueries({ queryKey: moderationKeys.leadStatus });
      toast(res.decided ? "Thanks. Leads reached a decision on this one." : "Vote recorded.");
    } catch (err) {
      toast(`Your vote wasn't recorded: ${errorMessage(err)}`, "error");
      void client.invalidateQueries({ queryKey: moderationKeys.queue });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <View style={styles.tags}>
        <Tag label={text.title} bg={t.colors.muted} fg={t.colors.foreground} />
        {item.reasons.map((r) => (
          <Tag key={r.reason} label={`${REASON_LABEL[r.reason] ?? r.reason}${r.count > 1 ? ` ×${r.count}` : ""}`} bg={t.colors.warningSoft} fg={t.colors.warning} />
        ))}
      </View>
      <SeeMoreText id={`case-${item.id}`} text={text.body} lines={6} />
      <View style={styles.meta}>
        <Clock size={14} color={t.colors.mutedForeground} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          {hoursLeft(item.closesAt)} · First reported {timeAgo(item.firstReportedAt)} · {item.votes} {item.votes === 1 ? "vote" : "votes"} so far
        </Text>
      </View>
      <View style={styles.votes} accessibilityRole="radiogroup" accessibilityLabel="Your vote">
        {VOTES.map((v) => {
          const mine = item.myVote === v.id;
          const fg = mine ? t.colors.primaryForeground : v.id === "remove" ? t.colors.destructive : t.colors.foreground;
          return (
            <Pressable
              key={v.id}
              onPress={() => void vote(v.id)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: mine, disabled: busy }}
              accessibilityLabel={`${v.label}. ${v.hint}`}
              // The same style keys whatever the state: Android draws a background added later wrongly.
              style={({ pressed }) => [
                styles.vote,
                { backgroundColor: mine ? t.colors.primary : pressed ? t.colors.muted : t.colors.card, borderColor: mine ? t.colors.primary : t.colors.border, opacity: busy ? 0.6 : 1 },
              ]}
            >
              <Text variant="label" style={{ color: fg }}>
                {v.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  guide: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  card: { padding: 14, gap: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  votes: { flexDirection: "row", gap: 8, marginTop: 2 },
  vote: { flex: 1, minHeight: MIN_TOUCH, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
