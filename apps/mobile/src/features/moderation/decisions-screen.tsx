import { errorMessage } from "@myhoodora/api-contract/errors";
import type { MyDecision } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Scale } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { openWeb } from "@/shared/utils/open-web";
import { timeAgo } from "@/shared/utils/time";
import { ACTION_LABEL, APPEAL_LABEL, APPEAL_MAX, APPEAL_MIN, fileAppeal, getMyDecisions, moderationKeys } from "./moderation-api";
import { FormScrollView } from "@/shared/ui/form-scroll-view";

/**
 * `/settings/moderation` (the web's Decisions & appeals, where moderation notifications lead):
 * decisions about your posts or account, and what happened to things you reported, from the last
 * 90 days. Each can be appealed once, within 30 days.
 */
export function DecisionsScreen() {
  return (
    <AppScreen title="Decisions & appeals" fallback="/settings">
      <Decisions />
    </AppScreen>
  );
}

function Decisions() {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const list = useQuery({ queryKey: moderationKeys.decisions, queryFn: () => getMyDecisions(user), staleTime: 0 });
  const pull = usePullRefresh(list.refetch);
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 };

  if (list.isPending) {
    return (
      <View style={[styles.list, pad]} accessible accessibilityLabel="Loading decisions">
        <Skeleton height={120} radius={20} />
        <Skeleton height={120} radius={20} />
      </View>
    );
  }
  if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Couldn't load decisions" />;

  return (
    <FlatList
      data={list.data}
      keyExtractor={(d) => d.caseId}
      contentContainerStyle={[styles.list, pad]}
      scrollIndicatorInsets={{ top: insets.top }}
      ListHeaderComponent={
        <Text tone="muted" variant="caption">
          Moderation decisions about your posts or account, and what happened to things you reported, from the last 90 days.
        </Text>
      }
      renderItem={({ item }) => <DecisionCard d={item} />}
      ListEmptyComponent={<EmptyState title="Nothing here" body="No moderation decisions involve you. Keep being a great neighbour!" />}
      ListFooterComponent={
        <Pressable onPress={() => void openWeb("/guidelines")} accessibilityRole="link" style={styles.footer}>
          <Text variant="caption" tone="muted">
            Decisions follow the <Text variant="caption" tone="primary">community guidelines</Text>. You can appeal each decision once, within 30 days.
          </Text>
        </Pressable>
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

function DecisionCard({ d }: { d: MyDecision }) {
  const t = useTheme();
  const router = useRouter();
  const kept = d.action === "keep";
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.tag, { backgroundColor: t.colors.muted }]}>
          <Text variant="caption">{d.role === "author" ? `Your ${d.target.type}` : "Your report"}</Text>
        </View>
        <Text variant="label" style={[styles.flex, { color: kept ? t.colors.mutedForeground : t.colors.warning }]} numberOfLines={2}>
          {ACTION_LABEL[d.action]}
        </Text>
        <Text variant="caption" tone="muted">
          {timeAgo(d.decidedAt)}
        </Text>
      </View>
      <Text numberOfLines={3} style={{ color: t.colors.foreground }}>
        “{d.target.preview}”
      </Text>
      <Text variant="caption" tone="muted">
        Reason: {d.reason}
      </Text>
      {d.appeal ? (
        <Text variant="label" tone="primary">
          {APPEAL_LABEL[d.appeal.status]}
          {d.appeal.outcomeReason ? <Text variant="caption" tone="muted">{` · ${d.appeal.outcomeReason}`}</Text> : null}
        </Text>
      ) : d.canAppeal ? (
        <Button label="Appeal this decision" variant="secondary" onPress={() => router.push(`/settings/moderation/${d.caseId}`)} style={styles.appeal} />
      ) : null}
    </View>
  );
}

/** `/settings/moderation/<caseId>`: why the decision should change. A different reviewer decides. */
export function AppealScreen({ caseId }: { caseId: string }) {
  const user = useSignedInUser();
  const list = useQuery({ queryKey: moderationKeys.decisions, queryFn: () => getMyDecisions(user) });
  const decision = list.data?.find((d) => d.caseId === caseId);
  if (!list.data) {
    return (
      <AppScreen title="Appeal" fallback="/settings/moderation">
        {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      </AppScreen>
    );
  }
  if (!decision || !decision.canAppeal) {
    return (
      <AppScreen title="Appeal" fallback="/settings/moderation">
        <EmptyState title={decision?.appeal ? "Already appealed" : "This decision can't be appealed"} body="Each decision can be appealed once, within 30 days." />
      </AppScreen>
    );
  }
  return <AppealForm decision={decision} />;
}

function AppealForm({ decision }: { decision: MyDecision }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const trimmed = reason.trim();
  const ready = trimmed.length >= APPEAL_MIN && !sending;

  usePreventRemove(trimmed.length > 0 && !sending, ({ data }) =>
    Alert.alert("Discard your appeal?", "What you've written won't be sent.", [
      { text: "Keep writing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]),
  );

  const send = async () => {
    if (!ready) return;
    setSending(true);
    setProblem(null);
    try {
      await fileAppeal(user, decision.caseId, trimmed);
      await client.invalidateQueries({ queryKey: moderationKeys.decisions });
      toast("Appeal sent. Someone who didn't make the original decision will review it.");
      router.back();
    } catch (err) {
      setProblem(errorMessage(err));
      setSending(false);
    }
  };

  return (
    <AppScreen title="Appeal this decision" fallback="/settings/moderation" canvas={false} footer={<SendBar ready={ready} sending={sending} onSend={() => void send()} />}>
      <AppealBody decision={decision} reason={reason} onChange={setReason} problem={problem} />
    </AppScreen>
  );
}

function SendBar({ ready, sending, onSend }: { ready: boolean; sending: boolean; onSend: () => void }) {
  const t = useTheme();
  const safe = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: t.colors.background, borderTopColor: t.colors.border, paddingBottom: Math.max(12, safe.bottom) }]}>
      <Button label="Send appeal" onPress={onSend} disabled={!ready} loading={sending} />
    </View>
  );
}

function AppealBody({ decision, reason, onChange, problem }: { decision: MyDecision; reason: string; onChange: (v: string) => void; problem: string | null }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);
  const short = reason.trim().length < APPEAL_MIN;
  return (
    <FormScrollView contentContainerStyle={[styles.form, { paddingTop: insets.top + 16, paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
      <View style={[styles.quote, { backgroundColor: t.colors.muted }]}>
        <Scale size={18} color={t.colors.mutedForeground} />
        <View style={styles.flex}>
          <Text variant="label">{ACTION_LABEL[decision.action]}</Text>
          <Text variant="caption" tone="muted" numberOfLines={3}>
            “{decision.target.preview}”
          </Text>
        </View>
      </View>
      <Text tone="muted">
        {decision.role === "reporter"
          ? "Tell us why you think this should be removed after all."
          : "Tell us why you think the decision was wrong. A different member of the team will review it."}
      </Text>
      {problem ? <InlineAlert>{`Your appeal wasn't sent: ${problem}`}</InlineAlert> : null}
      <TextInput
        ref={input}
        value={reason}
        onChangeText={onChange}
        multiline
        maxLength={APPEAL_MAX}
        placeholder="Your reason"
        placeholderTextColor={t.colors.mutedForeground}
        accessibilityLabel="Your reason for appealing"
        accessibilityHint={`At least ${APPEAL_MIN} characters`}
        textAlignVertical="top"
        style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular, borderColor: t.colors.border }]}
      />
      <Text variant="caption" tone="muted" style={styles.count}>
        {short ? `At least ${APPEAL_MIN} characters` : `${reason.length} / ${APPEAL_MAX}`}
      </Text>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  card: { padding: 14, gap: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  appeal: { alignSelf: "flex-start", marginTop: 4 },
  footer: { paddingVertical: 8 },
  form: { paddingHorizontal: 16, gap: 14 },
  quote: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 16 },
  input: { fontSize: 17, lineHeight: 24, minHeight: 140, borderWidth: 1, borderRadius: 16, padding: 12 },
  count: { textAlign: "right" },
  bar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
