import type { PublicProfile } from "@myhoodora/api-contract/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { PostCard } from "@/features/feed/post-card";
import { ListingCard } from "@/features/listings/listing-card";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Chip } from "@/shared/ui/chip";
import { useTabBarSpace } from "@/shared/ui/floating-tab-bar";
import { ConnectionStrip } from "@/shared/ui/connection-strip";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { search, SEARCH_MIN, type SearchType } from "./search-api";
import { useFeatureSignal } from "@/features/feedback/use-feature-signal";

const TYPES: { id: SearchType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "listings", label: "For Sale & Free" },
  { id: "people", label: "Neighbours" },
];

/** Ideas when the box is empty, as Nextdoor's "Ask your neighbors" suggestions: tap to search. */
const SUGGESTIONS = ["Electrician", "Generator repair", "Tailor", "Plumber", "Lost dog", "Security"];

/** Wait for a pause in typing before asking (and don't ask for every letter on mobile data). */
const DEBOUNCE_MS = 350;

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

function Person({ p }: { p: PublicProfile }) {
  const t = useTheme();
  return (
    <View style={[styles.person, { backgroundColor: t.colors.card }]}>
      <Avatar name={p.displayName} photoURL={p.photoURL} size={44} />
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Text variant="label">{p.displayName}</Text>
          {p.verified ? <ShieldCheck size={15} color={t.colors.success} accessibilityLabel="Verified neighbour" /> : null}
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {p.bio || p.neighborhoodName || "Neighbour"}
        </Text>
      </View>
    </View>
  );
}

function Section({ title, children, show }: { title: string; children: React.ReactNode; show: boolean }) {
  if (!show) return null;
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

/** Search your neighbourhood: posts, things for sale, neighbours (contract §21). */
export function SearchScreen() {
  useFeatureSignal("search");
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [text, setText] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const bottomSpace = useTabBarSpace();
  const q = useDebounced(text.trim());
  const ready = q.length >= SEARCH_MIN && hasHood(profile);
  const results = useQuery({ queryKey: ["search", q, type], queryFn: () => search(user, q, type), enabled: ready, placeholderData: keepPreviousData });

  const data = results.data;
  const nothing = data && !data.posts?.length && !data.listings?.length && !data.people?.length;
  const listings = data?.listings ?? [];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.canvas }]} edges={["top"]}>
        <ConnectionStrip style={styles.connection} />
      <View style={styles.top}>
        <Text style={[styles.title, { color: t.colors.foreground, fontFamily: t.fonts.bold }]} accessibilityRole="header">
          Search
        </Text>
        <View style={[styles.box, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <SearchIcon size={20} color={t.colors.mutedForeground} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search posts, items and neighbours"
            placeholderTextColor={t.colors.mutedForeground}
            returnKeyType="search"
            autoCorrect={false}
            maxLength={100}
            accessibilityLabel="Search your neighbourhood"
            style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {results.isFetching ? <ActivityIndicator size="small" color={t.colors.primary} /> : null}
          {text ? (
            <Pressable onPress={() => setText("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
              <X size={18} color={t.colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
          {TYPES.map((x) => (
            <Chip key={x.id} label={x.label} selected={x.id === type} onPress={() => setType(x.id)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={[styles.results, { paddingBottom: bottomSpace }]} scrollIndicatorInsets={{ bottom: bottomSpace }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!hasHood(profile) ? (
          <EmptyState title="Join your neighbourhood first" body="Search looks through your neighbourhood's posts, listings and neighbours." />
        ) : q.length < SEARCH_MIN ? (
          <View style={styles.section}>
            <Text variant="label" tone="muted">
              Try searching for
            </Text>
            <View style={styles.wrap}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => setText(s)} />
              ))}
            </View>
          </View>
        ) : results.isError && !data ? (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} />
        ) : nothing ? (
          <EmptyState title={`Nothing for “${q}”`} body="Try another word, or ask your neighbours in a post." />
        ) : (
          <>
            <Section title="Posts" show={!!data?.posts?.length}>
              {data?.posts?.map((p) => <PostCard key={p._id} post={p} />)}
            </Section>
            <Section title="For Sale & Free" show={listings.length > 0}>
              <View style={styles.grid}>
                {listings.map((l) => (
                  <View key={l._id} style={styles.cell}>
                    <ListingCard listing={l} />
                  </View>
                ))}
              </View>
            </Section>
            <Section title="Neighbours" show={!!data?.people?.length}>
              {data?.people?.map((p) => <Person key={p.uid} p={p} />)}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: 16 },
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  title: { fontSize: 28, lineHeight: 34 },
  box: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, minHeight: MIN_TOUCH },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  chipRow: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  results: { padding: 16, gap: 20, flexGrow: 1 },
  section: { gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47.5%", flexDirection: "row" },
  person: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
});
