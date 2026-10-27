import type { ApiPost } from "@myhoodora/api-contract/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { PostSkeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { FEED_PAGE, feedKeys, listSaved } from "./feed-api";
import { PostCard } from "./post-card";

type Saved = ApiPost & { savedAt: string };

/** `/saved`: the posts you saved, newest saved first. Unsave from a post's ⋯ menu. */
export function SavedPostsScreen() {
  return (
    <AppScreen title="Saved posts" fallback="/more">
      <SavedList />
    </AppScreen>
  );
}

function SavedList() {
  const t = useTheme();
  const user = useSignedInUser();
  const router = useRouter();
  const insets = useScreenInsets();
  const saved = useInfiniteQuery({
    queryKey: feedKeys.saved,
    queryFn: ({ pageParam }) => listSaved(user, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: Saved[]) => (page.length < FEED_PAGE ? undefined : page[page.length - 1]?.savedAt),
  });
  // An unsaved post leaves the list straight away, though the server copy still has it until a refresh.
  const posts = (saved.data?.pages.flat() ?? []).filter((p) => p.saved !== false);

  return (
    <FlatList
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}
      scrollIndicatorInsets={{ top: insets.top }}
      data={saved.isPending ? [] : posts}
      keyExtractor={(p) => p._id}
      renderItem={({ item }) => <PostCard post={item} />}
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={
        saved.isPending ? (
          <View accessible accessibilityLabel="Loading your saved posts">
            <PostSkeleton />
          </View>
        ) : saved.isError ? (
          <ErrorState error={saved.error} onRetry={() => void saved.refetch()} title="Couldn't load your saved posts" />
        ) : (
          <EmptyState title="Nothing saved yet" body="Save a post from its ⋯ menu to keep it here for later." action={{ label: "Go to the feed", onPress: () => router.navigate("/news-feed") }} />
        )
      }
      ListFooterComponent={saved.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={t.colors.primary} accessibilityLabel="Loading more" /> : null}
      onEndReached={() => saved.hasNextPage && !saved.isFetchingNextPage && void saved.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={saved.isRefetching && !saved.isFetchingNextPage} onRefresh={() => void saved.refetch()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  gap: { height: 8 },
  footer: { paddingVertical: 16 },
});
