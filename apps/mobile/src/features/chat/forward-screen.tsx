import { errorMessage } from "@myhoodora/api-contract/errors";
import {
  MAX_FORWARD_TO,
  type Conversation,
  type Message,
} from "@myhoodora/api-contract/types";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, Forward, Search, Send, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { searchNeighbours } from "@/features/account/account-api";
import {
  chatKeys,
  forwardMessage,
  listConversations,
  otherPerson,
} from "./chat-api";

/** A chat to forward to: one you have, or a neighbour you haven't written to yet. */
interface Target {
  key: string;
  name: string;
  photoURL?: string;
  line?: string;
  conversationId?: string;
  uid?: string;
}

function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

const chatTarget = (c: Conversation, me: string): Target => {
  const other = otherPerson(c, me);
  return {
    key: `c:${c._id}`,
    name: other?.displayName ?? "A neighbour",
    photoURL: other?.photoURL,
    line: c.context?.title,
    conversationId: c._id,
  };
};

/**
 * `/inbox/forward?from&message`: WhatsApp's "Forward to…". Your chats, or search for a neighbour;
 * tick up to 5 (one, for a message forwarded many times) and send. It arrives marked "Forwarded".
 */
export function ForwardScreen({
  from,
  messageId,
}: {
  from: string;
  messageId: string;
}) {
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Target[]>([]);
  const [sending, setSending] = useState(false);
  const q = useDebounced(text.trim());
  const message = client
    .getQueryData<Message[]>(chatKeys.messages(from))
    ?.find((m) => m._id === messageId);
  const limit = message?.forwardedManyTimes ? 1 : MAX_FORWARD_TO;

  const chats = useQuery({
    queryKey: chatKeys.list(false),
    queryFn: () => listConversations(user, false),
  });
  const found = useQuery({
    queryKey: ["neighbours", q],
    queryFn: () => searchNeighbours(user, q),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
  const searching = q.length >= 2;

  const rows = useMemo(() => {
    const mine = (chats.data ?? []).map((c) => chatTarget(c, user.uid));
    if (!searching) return mine;
    const needle = q.toLowerCase();
    const matching = mine.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.line?.toLowerCase().includes(needle),
    );
    // A neighbour you already have a plain chat with goes there; otherwise a chat is opened on sending.
    const direct = new Map(
      (chats.data ?? [])
        .filter((c) => !c.context)
        .map((c) => [otherPerson(c, user.uid)?.uid, c]),
    );
    const people: Target[] = (found.data ?? [])
      .filter((p) => p.uid !== user.uid)
      .filter(
        (p) =>
          !matching.some(
            (r) =>
              r.conversationId && r.conversationId === direct.get(p.uid)?._id,
          ),
      )
      .map((p) => {
        const c = direct.get(p.uid);
        return c
          ? chatTarget(c, user.uid)
          : {
              key: `u:${p.uid}`,
              name: p.displayName,
              photoURL: p.photoURL,
              line: p.neighborhoodName,
              uid: p.uid,
            };
      });
    return [...matching, ...people];
  }, [chats.data, found.data, searching, q, user.uid]);

  const toggle = (r: Target) => {
    if (picked.some((p) => p.key === r.key))
      return setPicked(picked.filter((p) => p.key !== r.key));
    if (picked.length >= limit) {
      return toast(
        limit === 1
          ? "Messages forwarded many times can be sent to one chat at a time."
          : `You can forward to up to ${MAX_FORWARD_TO} chats at a time.`,
        "error",
      );
    }
    setPicked([...picked, r]);
  };

  const send = async () => {
    if (!picked.length || sending) return;
    setSending(true);
    try {
      const res = await forwardMessage(user, from, messageId, {
        conversationIds: picked.flatMap((p) =>
          p.conversationId ? [p.conversationId] : [],
        ),
        recipientUids: picked.flatMap((p) => (p.uid ? [p.uid] : [])),
      });
      void client.invalidateQueries({ queryKey: chatKeys.all });
      const failed = res.failed[0];
      const who =
        failed &&
        picked.find(
          (p) => p.conversationId === failed.target || p.uid === failed.target,
        )?.name;
      if (failed)
        toast(`Not sent to ${who ?? "one chat"}: ${failed.message}`, "error");
      if (!res.sent.length) return setSending(false);
      if (!failed)
        toast(
          res.sent.length === 1
            ? "Forwarded."
            : `Forwarded to ${res.sent.length} chats.`,
        );
      // To one other chat, WhatsApp opens it; to several (or this one), you go back where you were.
      if (res.sent.length === 1 && picked.length === 1 && res.sent[0] !== from)
        router.replace(`/inbox/${res.sent[0]}`);
      else router.back();
    } catch (err) {
      toast(errorMessage(err), "error");
      setSending(false);
    }
  };

  const what = message
    ? message.body || (message.photos?.length ? "📷 Photo" : "")
    : "";
  const bar = picked.length ? (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: safe.bottom + 10,
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
        },
      ]}
    >
      <View style={styles.flex}>
        {what ? (
          <View style={styles.inline}>
            <Forward size={13} color={t.colors.mutedForeground} />
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={styles.flex}
            >
              {what}
            </Text>
          </View>
        ) : null}
        <Text variant="label" numberOfLines={2}>
          {picked.map((p) => p.name).join(", ")}
        </Text>
      </View>
      <Pressable
        onPress={() => void send()}
        disabled={sending}
        accessibilityRole="button"
        accessibilityLabel={`Send to ${picked.length === 1 ? picked[0]!.name : `${picked.length} chats`}`}
        style={[styles.send, { backgroundColor: t.colors.primary }]}
      >
        {sending ? (
          <ActivityIndicator color={t.colors.primaryForeground} />
        ) : (
          <Send size={20} color={t.colors.primaryForeground} />
        )}
      </Pressable>
    </View>
  ) : undefined;

  return (
    <AppScreen
      title="Forward to…"
      fallback={`/inbox/${from}`}
      canvas={false}
      footer={bar}
    >
      <PickerBody>
        <View style={[styles.header]}>
          <View style={[styles.box, { backgroundColor: t.colors.muted }]}>
            <Search size={18} color={t.colors.mutedForeground} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search chats or neighbours"
              placeholderTextColor={t.colors.mutedForeground}
              autoCorrect={false}
              accessibilityLabel="Search chats or neighbours"
              style={[
                styles.input,
                { color: t.colors.foreground, fontFamily: t.fonts.regular },
              ]}
            />
            {found.isFetching ? (
              <ActivityIndicator size="small" color={t.colors.primary} />
            ) : text ? (
              <Pressable
                onPress={() => setText("")}
                accessibilityRole="button"
                accessibilityLabel="Clear"
                hitSlop={10}
              >
                <X size={18} color={t.colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          <Text variant="caption" tone="muted">
            {limit === 1
              ? "This message has been forwarded many times, so it can go to one chat at a time."
              : `Choose up to ${MAX_FORWARD_TO} chats.`}
          </Text>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.flex}
          contentContainerStyle={[styles.grow, { paddingBottom: 24 }]}
          renderItem={({ item }) => {
            const on = picked.some((p) => p.key === item.key);
            return (
              <Pressable
                onPress={() => toggle(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${item.name}${item.line ? `, ${item.line}` : ""}`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? t.colors.muted : "transparent" },
                ]}
              >
                <View>
                  <Avatar name={item.name} photoURL={item.photoURL} size={44} />
                  {on ? (
                    <View
                      style={[
                        styles.tick,
                        {
                          backgroundColor: t.colors.primary,
                          borderColor: t.colors.background,
                        },
                      ]}
                    >
                      <Check
                        size={12}
                        color={t.colors.primaryForeground}
                        strokeWidth={3}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={styles.flex}>
                  <Text variant="label" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.line ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {item.line}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            searching && found.data ? (
              <EmptyState
                title={`No one called “${q}”`}
                body="Search your chats, or neighbours in your neighbourhood."
              />
            ) : !searching && chats.data ? (
              <EmptyState
                title="No chats yet"
                body="Search for a neighbour to forward it to."
              />
            ) : null
          }
        />
      </PickerBody>
    </AppScreen>
  );
}

/** Inside AppScreen, to clear its header. */
function PickerBody({ children }: { children: React.ReactNode }) {
  const insets = useScreenInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 12 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: MIN_TOUCH,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: MIN_TOUCH + 16,
  },
  tick: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
