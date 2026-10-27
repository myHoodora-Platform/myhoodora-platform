import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Ban, Ellipsis, Flag } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { useRouter } from "@/core/navigation/use-router";
import {
  accountKeys,
  blockUser,
  getPublicProfile,
} from "@/features/account/account-api";
import { feedKeys } from "@/features/feed/feed-api";
import { PostCard } from "@/features/feed/post-card";
import { ReportSheet } from "@/features/feed/report-sheet";
import { ListingCard } from "@/features/listings/listing-card";
import { listBySeller, listingKeys } from "@/features/listings/listings-api";
import { useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/icon-button";
import { Segmented } from "@/shared/ui/settings";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { firstName } from "@/shared/utils/format";
import { NeighbourCard } from "./neighbour-card";
import { useMessageNeighbour } from "./use-message-neighbour";

type Tab = "posts" | "selling";

/** Their posts among those you've loaded in the feed (as the web does; there's no list by author), newest first. */
function usePostsSeen(uid: string): ApiPost[] {
  const client = useQueryClient();
  return useMemo(() => {
    const seen = new Map<string, ApiPost>();
    for (const [, data] of client.getQueriesData<InfiniteData<ApiPost[]>>({
      queryKey: feedKeys.all,
    })) {
      for (const p of data?.pages?.flat() ?? [])
        if (p.authorUid === uid) seen.set(p._id, p);
    }
    return [...seen.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [client, uid]);
}

/** Why a profile can't be shown, in the API's words (it knows whether they left, chose privacy, or live too far away). */
function Unavailable({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : 0;
  const title =
    status === 410
      ? "Account deactivated"
      : status === 403
        ? "Profile is restricted"
        : "Profile not available";
  return (
    <EmptyState
      title={title}
      body={
        status === 410
          ? "This neighbour has deactivated their account, so their profile isn't available."
          : errorMessage(error)
      }
    />
  );
}

/** Room for the screen's header and the phone's bottom edge (read inside AppScreen, which knows them). */
function Insets({
  children,
}: {
  children: (pad: { paddingTop: number; paddingBottom: number }) => ReactNode;
}) {
  const insets = useScreenInsets();
  return children({
    paddingTop: insets.top,
    paddingBottom: insets.bottom + 24,
  });
}

function Inset({ children }: { children: ReactNode }) {
  const insets = useScreenInsets();
  return (
    <View style={[styles.pad, { paddingTop: insets.top + 24 }]}>
      {children}
    </View>
  );
}

/**
 * `/u/<uid>`: a neighbour as they show themselves (public fields only), with Message, and the "⋯"
 * for blocking or reporting them. Below: their posts you've seen, and what they're selling.
 */
export function NeighbourScreen({ uid }: { uid: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile: me } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const message = useMessageNeighbour();
  const [tab, setTab] = useState<Tab>("posts");
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const profile = useQuery({
    queryKey: accountKeys.publicProfile(uid),
    queryFn: () => getPublicProfile(user, uid),
  });
  const posts = usePostsSeen(uid);
  const hoodId = hasHood(me) ? me.neighborhoodId : null;
  const listings = useQuery({
    queryKey: listingKeys.seller(hoodId ?? "", uid),
    queryFn: () => listBySeller(user, hoodId!, uid),
    enabled: !!hoodId && tab === "selling",
  });
  const name = profile.data?.displayName ?? "this neighbour";

  const block = () =>
    Alert.alert(
      `Block ${firstName(name) || "them"}?`,
      "They won't see your posts or profile, can't message you, and you won't see theirs. They aren't told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(user, uid);
              toast(
                `${firstName(name) || "They"} won't see you, and you won't see them.`,
              );
              void client.invalidateQueries({ queryKey: feedKeys.all });
              router.back();
            } catch (err) {
              toast(errorMessage(err), "error");
            }
          },
        },
      ],
    );

  if (!profile.data) {
    return (
      <AppScreen title="Profile" canvas={false}>
        <Inset>
          {profile.isError ? (
            <Unavailable error={profile.error} />
          ) : (
            <View
              style={styles.loading}
              accessible
              accessibilityLabel="Loading profile"
            >
              <Skeleton width={88} height={88} radius={44} />
              <Skeleton width="50%" height={22} />
              <Skeleton width="65%" height={16} />
            </View>
          )}
        </Inset>
      </AppScreen>
    );
  }

  const header = (
    <View style={styles.head}>
      <NeighbourCard profile={profile.data} />
      <Button
        label={`Message ${firstName(name)}`}
        loading={message.busy}
        onPress={() => void message.open(uid)}
      />
      <Segmented<Tab>
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { id: "posts", label: "Posts" },
          { id: "selling", label: "For sale" },
        ]}
      />
      {tab === "posts" && posts.length ? (
        <Text variant="caption" tone="muted">
          Posts of theirs you&apos;ve seen in your feed.
        </Text>
      ) : null}
    </View>
  );

  return (
    <AppScreen
      title={name}
      canvas={false}
      right={
        <IconButton
          Icon={Ellipsis}
          label={`More options for ${name}`}
          onPress={() => setMenu(true)}
        />
      }
    >
      <Insets>
        {(pad) => (
          <>
            {/* Two lists, not one changing shape: a list can't change its column count while shown. */}
            {tab === "posts" ? (
              <FlatList
                key="posts"
                style={{ backgroundColor: t.colors.canvas }}
                contentContainerStyle={pad}
                data={posts}
                keyExtractor={(p) => p._id}
                renderItem={({ item }) => <PostCard post={item} />}
                ItemSeparatorComponent={() => <View style={styles.gap} />}
                ListHeaderComponent={header}
                ListEmptyComponent={
                  <EmptyState
                    title="No posts to show"
                    body={`Posts from ${firstName(name) || "them"} appear here once they're in your feed.`}
                  />
                }
              />
            ) : (
              <FlatList
                key="selling"
                style={{ backgroundColor: t.colors.canvas }}
                contentContainerStyle={pad}
                data={listings.data ?? []}
                keyExtractor={(l) => l._id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                renderItem={({ item }) => (
                  <View style={styles.cell}>
                    <ListingCard listing={item} />
                  </View>
                )}
                ListHeaderComponent={header}
                ListEmptyComponent={
                  listings.isPending ? (
                    <Skeleton
                      height={190}
                      radius={20}
                      style={styles.skeleton}
                    />
                  ) : (
                    <EmptyState
                      title="Nothing for sale"
                      body={`${firstName(name) || "They"} isn't selling anything right now.`}
                    />
                  )
                }
              />
            )}
          </>
        )}
      </Insets>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        label={`Options for ${name}`}
        groups={[
          [
            {
              key: "report",
              label: `Report ${firstName(name)}`,
              hint: "Private: they won't know it was you",
              Icon: Flag,
              onPress: () => setTimeout(() => setReporting(true), 350),
            },
            {
              key: "block",
              label: `Block ${firstName(name)}`,
              hint: "They aren't told",
              Icon: Ban,
              destructive: true,
              onPress: block,
            },
          ],
        ]}
      />
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="user"
        targetId={uid}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
  loading: { alignItems: "center", gap: 12 },
  head: { padding: 16, gap: 16, backgroundColor: "transparent" },
  gap: { height: 8 },
  row: { gap: 12, paddingHorizontal: 16 },
  cell: { flex: 1, marginBottom: 12 },
  skeleton: { marginHorizontal: 16 },
});
