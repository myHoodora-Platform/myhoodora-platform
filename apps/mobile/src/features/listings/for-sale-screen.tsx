import type { Listing } from "@myhoodora/api-contract/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useTheme } from "@/shared/theme/theme";
import { Chip } from "@/shared/ui/chip";
import { useTabBarSpace } from "@/shared/ui/floating-tab-bar";
import { IconButton } from "@/shared/ui/icon-button";
import { ConnectionStrip } from "@/shared/ui/connection-strip";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { ListingCard } from "./listing-card";
import { LISTING_CATEGORIES, listingKeys, listListings, type ListingFilter } from "./listings-api";

const FILTERS: { id: ListingFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "free", label: "Free" }, ...LISTING_CATEGORIES];

function GridSkeleton() {
  return (
    <View style={styles.skeleton} accessible accessibilityLabel="Loading listings" accessibilityState={{ busy: true }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonTile}>
          <Skeleton height={160} radius={20} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="80%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** For Sale & Free in your neighbourhood (Nextdoor's For Sale tab): a photo grid with filters. */
export function ForSaleScreen() {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<ListingFilter>("all");
  const bottomSpace = useTabBarSpace();
  const hoodId = hasHood(profile) ? profile.neighborhoodId : null;
  const listings = useQuery({ queryKey: listingKeys.list(hoodId ?? "", filter), queryFn: () => listListings(user, hoodId!, filter), enabled: !!hoodId });
  // Half the row each: a lone last tile keeps its half instead of stretching across.
  const pull = usePullRefresh(listings.refetch);
  const renderItem = useCallback(
    ({ item }: { item: Listing }) => (
      <View style={styles.cell}>
        <ListingCard listing={item} />
      </View>
    ),
    [],
  );
  const router = useRouter();
  const sell = () => router.push("/sell");

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.colors.foreground, fontFamily: t.fonts.bold }]} accessibilityRole="header">
          For Sale & Free
        </Text>
        <IconButton Icon={Plus} label="Sell or give something away" onPress={sell} filled />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={f.id === filter} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>
    </View>
  );

  if (!hoodId) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.canvas }]} edges={["top"]}>
        <ConnectionStrip style={styles.connection} />
        <EmptyState title="Join your neighbourhood first" body="For Sale & Free shows what neighbours are selling and giving away nearby, once you've confirmed where you live." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.canvas }]} edges={["top"]}>
        <ConnectionStrip style={styles.connection} />
      <FlatList
        data={listings.data ?? []}
        keyExtractor={(l) => l._id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}
        scrollIndicatorInsets={{ bottom: bottomSpace }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          listings.isPending ? (
            <GridSkeleton />
          ) : listings.isError && !listings.data ? (
            <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
          ) : (
            <EmptyState
              title={filter === "all" ? "Nothing for sale yet" : "Nothing here yet"}
              body="Be the first to sell or give something away to your neighbours."
              action={{ label: "Sell something", onPress: sell }}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: 16 },
  flex: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  cell: { flex: 0.5, flexDirection: "row" },
  header: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, lineHeight: 34 },
  chipRow: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  skeleton: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  skeletonTile: { width: "47%", gap: 8 },
});
