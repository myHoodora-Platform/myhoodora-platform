import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Conversation } from "@myhoodora/api-contract/types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { searchNeighbours } from "@/features/account/account-api";
import { chatKeys, otherPerson, startConversation } from "./chat-api";

interface Person {
  uid: string;
  displayName: string;
  photoURL?: string;
  line?: string;
  verified?: boolean;
}

function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * `/inbox/new`: write to any neighbour. Type a name to search your neighbourhood; before that, the
 * people you've talked to lately. Opens your existing chat with them if there is one.
 */
export function NewMessageScreen() {
  return (
    <AppScreen title="New message" fallback="/inbox" canvas={false}>
      <NewMessage />
    </AppScreen>
  );
}

/** Inside AppScreen, so it can read how far to clear the header (useScreenInsets). */
function NewMessage() {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const q = useDebounced(text.trim());
  const found = useQuery({ queryKey: ["neighbours", q], queryFn: () => searchNeighbours(user, q), enabled: q.length >= 2, placeholderData: keepPreviousData });
  // Recent people come from the inbox already loaded; nothing extra is fetched.
  const recent: Person[] = (client.getQueryData<Conversation[]>(chatKeys.list(false)) ?? [])
    .map((c) => otherPerson(c, user.uid))
    .filter((p, i, all): p is NonNullable<typeof p> => !!p && all.findIndex((x) => x?.uid === p.uid) === i)
    .slice(0, 8)
    .map((p) => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL, line: "You've talked before" }));
  const searching = q.length >= 2;
  const people: Person[] = searching
    ? (found.data ?? []).filter((p) => p.uid !== user.uid).map((p) => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL, line: p.neighborhoodName, verified: p.verified }))
    : recent;

  const open = async (p: Person) => {
    if (opening) return;
    setOpening(p.uid);
    try {
      const convo = await startConversation(user, p.uid);
      // Back from the chat comes to Messages, not here.
      router.replace(`/inbox/${convo._id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
      setOpening(null);
    }
  };

  return (
    <>
      {/* The "To:" box stays put above the results; only the results scroll. */}
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={styles.header}>
            <View style={[styles.box, { backgroundColor: t.colors.muted }]}>
              <Text variant="label" tone="muted">
                To:
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="A neighbour's name"
                placeholderTextColor={t.colors.mutedForeground}
                autoFocus
                autoCorrect={false}
                accessibilityLabel="Who to message: a neighbour's name"
                style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
              />
              {found.isFetching ? <ActivityIndicator size="small" color={t.colors.primary} /> : text ? (
                <Pressable onPress={() => setText("")} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10}>
                  <X size={18} color={t.colors.mutedForeground} />
                </Pressable>
              ) : (
                <Search size={18} color={t.colors.mutedForeground} />
              )}
            </View>
            {people.length ? (
              <Text variant="caption" tone="muted" style={styles.section}>
                {searching ? "Neighbours" : "Recent"}
              </Text>
            ) : null}
          </View>
      </View>
      <FlatList
        data={people}
        keyExtractor={(p) => p.uid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.flex}
        contentContainerStyle={[styles.grow, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void open(item)}
            disabled={!!opening}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.displayName}`}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent", opacity: opening && opening !== item.uid ? 0.5 : 1 }]}
          >
            <Avatar name={item.displayName} photoURL={item.photoURL} size={44} />
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text variant="label" numberOfLines={1} style={styles.shrink}>
                  {item.displayName}
                </Text>
                {item.verified ? <ShieldCheck size={15} color={t.colors.success} accessibilityLabel="Verified neighbour" /> : null}
              </View>
              {item.line ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {item.line}
                </Text>
              ) : null}
            </View>
            {opening === item.uid ? <ActivityIndicator color={t.colors.primary} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          searching && found.data ? (
            <EmptyState title={`No neighbours called “${q}”`} body="You can message verified neighbours in your neighbourhood, and sellers from their listing." />
          ) : !searching ? (
            <EmptyState title="Who would you like to message?" body="Type a neighbour's name to find them." />
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  grow: { flexGrow: 1 },
  header: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  box: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 14, minHeight: MIN_TOUCH },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  section: { marginTop: 6, textTransform: "uppercase" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: MIN_TOUCH + 16 },
});
