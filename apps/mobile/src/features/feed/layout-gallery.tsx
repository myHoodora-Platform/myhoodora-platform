import type { ApiPost } from "@myhoodora/api-contract/types";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Chip } from "@/shared/ui/chip";
import { FeedSkeleton } from "@/shared/ui/skeleton";
import { layoutFixtures } from "./layout-fixtures";
import { PostCard } from "./post-card";

/**
 * QA only: the feed's cards with made-up posts of every shape, and the loading state, to check layouts
 * on a real phone. Their buttons call the API with ids it doesn't know, so actions fail politely.
 */
export function LayoutGallery() {
  return (
    <AppScreen title="Feed layouts" canvas={false}>
      <Gallery />
    </AppScreen>
  );
}

/** Inside AppScreen, so it knows how tall the header is. */
function Gallery() {
  const t = useTheme();
  const user = useSignedInUser();
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(false);
  const posts = useMemo(() => layoutFixtures(user.uid), [user.uid]);
  return (
    <FlatList<ApiPost>
      style={{ backgroundColor: t.colors.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 24,
      }}
      data={loading ? [] : posts}
      keyExtractor={(p) => p._id}
      renderItem={({ item }) => <PostCard post={item} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={
        <View style={styles.chips}>
          <Chip
            label="Posts"
            selected={!loading}
            onPress={() => setLoading(false)}
          />
          <Chip
            label="Loading"
            selected={loading}
            onPress={() => setLoading(true)}
          />
        </View>
      }
      ListEmptyComponent={<FeedSkeleton />}
    />
  );
}

const styles = StyleSheet.create({
  gap: { height: 8 },
  chips: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
