import type { Listing } from "@myhoodora/api-contract/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { firstName } from "@/shared/utils/format";
import { ListingCard } from "./listing-card";
import { listBySeller, listingKeys } from "./listings-api";

/**
 * `/for-sale/seller/<uid>`: everything one seller has for sale, as a grid. Opened from "See all from
 * Ada" on her promoted items in the feed, so it works for a seller in another neighbourhood while
 * her promotion reaches yours (the API decides).
 */
export function SellerListingsScreen({ uid, name }: { uid: string; name?: string }) {
  const first = name ? firstName(name) : "";
  return (
    <AppScreen title={first ? `${first}'s items` : "Items for sale"} fallback="/for-sale">
      <Grid uid={uid} first={first} />
    </AppScreen>
  );
}

function Grid({ uid, first }: { uid: string; first: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const insets = useScreenInsets();
  const hoodId = hasHood(profile) ? profile.neighborhoodId : null;
  const listings = useQuery({ queryKey: listingKeys.seller(hoodId ?? "", uid), queryFn: () => listBySeller(user, hoodId!, uid), enabled: !!hoodId });
  const pull = usePullRefresh(listings.refetch);
  const renderItem = useCallback(
    ({ item }: { item: Listing }) => (
      <View style={styles.cell}>
        <ListingCard listing={item} />
      </View>
    ),
    [],
  );
  return (
    <FlatList
      data={listings.data ?? []}
      keyExtractor={(l) => l._id}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom }}
      ListEmptyComponent={
        listings.isPending ? (
          <View style={styles.skeleton} accessible accessibilityLabel="Loading items" accessibilityState={{ busy: true }}>
            <Skeleton width="48%" height={200} radius={20} />
            <Skeleton width="48%" height={200} radius={20} />
          </View>
        ) : listings.isError && !listings.data ? (
          <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
        ) : (
          <EmptyState title="Nothing for sale right now" body={`${first || "This seller"} has nothing for sale at the moment. Check back later.`} />
        )
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  cell: { flex: 0.5, flexDirection: "row" },
  skeleton: { flexDirection: "row", gap: 12 },
});
