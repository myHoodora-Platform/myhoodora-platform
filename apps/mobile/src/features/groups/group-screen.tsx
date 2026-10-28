import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Group, GroupPost } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Check, ChevronDown, Lock, LogOut, MoreHorizontal, Send, Settings2, Trash2, UserPlus, X } from "lucide-react-native";
import { useState } from "react";
import {ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { accent } from "@/shared/theme/accents";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { IconButton } from "@/shared/ui/icon-button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { sizedImage } from "@/shared/utils/media";
import { timeAgo } from "@/shared/utils/time";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { SeeMoreText } from "@/features/feed/see-more-text";
import { GroupMetaLine } from "./group-parts";
import { createGroupPost, deleteGroupPost, getGroup, GROUP_CATEGORY, groupKeys, joinGroup, leaveGroup, listGroupPosts } from "./groups-api";
import { showDialog } from "@/shared/ui/dialog";

/** Who may invite: any member of an open group; only admins of a private one (contract §8). */
export const canInvite = (g: Group) => g.membership === "member" && (g.privacy === "open" || g.isAdmin);

/**
 * `/g/<id>` (the web's group page): the cover, what it's for, Join or your membership, Invite, and the
 * group's posts with a box to write one. A private group shows only its outside until you're in.
 */
export function GroupScreen({ id, invite }: { id: string; invite?: string }) {
  const user = useSignedInUser();
  const router = useRouter();
  const group = useQuery({ queryKey: groupKeys.one(id), queryFn: () => getGroup(user, id, invite) });
  const g = group.data;
  return (
    <AppScreen
      title={g?.name ?? "Group"}
      fallback="/groups"
      right={g?.isAdmin ? <IconButton Icon={Settings2} label="Manage group" onPress={() => router.push(`/g/${id}/manage`)} /> : undefined}
    >
      {g ? <GroupBody group={g} invite={invite} refetchGroup={group.refetch} /> : group.isPending ? <HeaderSkeleton /> : <ErrorState error={group.error} onRetry={() => void group.refetch()} />}
    </AppScreen>
  );
}

function HeaderSkeleton() {
  const insets = useScreenInsets();
  return (
    <View style={[styles.pad, { paddingTop: insets.top + 12, gap: 12 }]} accessible accessibilityLabel="Loading the group">
      <Skeleton height={150} radius={20} />
      <Skeleton width="60%" height={22} />
      <Skeleton width="40%" height={14} />
      <Skeleton height={48} radius={14} />
    </View>
  );
}

function GroupBody({ group: g, invite, refetchGroup }: { group: Group; invite?: string; refetchGroup: () => Promise<unknown> }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const member = g.membership === "member";
  const canRead = member || g.privacy === "open";
  const posts = useQuery({ queryKey: groupKeys.posts(g._id), queryFn: () => listGroupPosts(user, g._id), enabled: canRead });
  const pull = usePullRefresh(() => Promise.all([refetchGroup(), canRead ? posts.refetch() : null]));

  return (
    <FlatList
      data={canRead ? (posts.data ?? []) : []}
      keyExtractor={(p) => p._id}
      contentContainerStyle={[styles.grow, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <Hero group={g} />
          <View style={[styles.pad, styles.headerText]}>
            <Text variant="title" accessibilityRole="header">
              {g.name}
            </Text>
            <GroupMetaLine group={g} />
            <View style={styles.description}>
              <SeeMoreText id={`group-${g._id}`} text={g.description} lines={4} />
            </View>
            <Actions group={g} invite={invite} />
          </View>
          {member ? <Composer groupId={g._id} /> : null}
          {canRead ? (
            <Text variant="label" tone="muted" style={[styles.pad, styles.section]}>
              Posts
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <GroupPostCard post={item} group={g} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.colors.canvas }]} />}
      ListEmptyComponent={
        !canRead ? (
          <View style={[styles.locked, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Lock size={28} color={t.colors.mutedForeground} />
            <Text variant="heading">This group is private</Text>
            <Text tone="muted" style={styles.centre}>
              {g.membership === "requested" ? "Your request is with the admins. You'll see posts once they let you in." : "Ask to join, and once an admin lets you in you'll see its posts and members."}
            </Text>
          </View>
        ) : posts.isPending ? (
          <ActivityIndicator style={styles.loading} color={t.colors.primary} accessibilityLabel="Loading posts" />
        ) : posts.isError && !posts.data ? (
          <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
        ) : (
          <EmptyState title="No posts yet" body={member ? "Start the conversation: say hello, or share something for the group." : "Join to start the conversation."} />
        )
      }
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    />
  );
}

/** The cover photo, or a band in the category's colour with its icon. */
function Hero({ group: g }: { group: Group }) {
  const t = useTheme();
  const c = GROUP_CATEGORY[g.category] ?? GROUP_CATEGORY.other;
  const [bg, fg] = accent(c.tone, t.scheme);
  if (g.coverPhoto) return <Image source={sizedImage(g.coverPhoto, 400)} style={[styles.cover, { backgroundColor: bg }]} contentFit="cover" transition={200} accessibilityLabel={`${g.name} cover photo`} />;
  return (
    <View style={[styles.cover, styles.band, { backgroundColor: bg }]}>
      <c.Icon size={56} color={fg} />
    </View>
  );
}

/**
 * Your place in the group: Join / Ask to join, Requested (tap to cancel), or Joined (tap to leave); and
 * Invite beside it when you may.
 */
function Actions({ group: g, invite }: { group: Group; invite?: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: groupKeys.all });
  const join = useMutation({
    mutationFn: () => joinGroup(user, g._id, invite),
    onSuccess: ({ membership }) => {
      client.setQueryData<Group>(groupKeys.one(g._id), (x) => (x ? { ...x, membership, memberCount: x.memberCount + (membership === "member" ? 1 : 0) } : x));
      toast(membership === "member" ? `Welcome to ${g.name}.` : "Request sent. An admin will let you in.");
      void refresh();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const leave = useMutation({
    mutationFn: () => leaveGroup(user, g._id),
    onSuccess: () => {
      const was = g.membership;
      client.setQueryData<Group>(groupKeys.one(g._id), (x) => (x ? { ...x, membership: "none", isAdmin: false, memberCount: x.memberCount - (was === "member" ? 1 : 0) } : x));
      toast(was === "member" ? `You left ${g.name}.` : "Request cancelled.");
      void refresh();
    },
    // e.g. 409: the last admin must hand over first.
    onError: (err) => showDialog("Couldn't leave", errorMessage(err)),
  });
  const confirmLeave = () =>
    showDialog(`Leave ${g.name}?`, g.privacy === "private" ? "You'll need an admin to let you back in." : "You can join again at any time.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
    ]);

  const busy = join.isPending || leave.isPending;
  const member = g.membership === "member";
  const requested = g.membership === "requested";
  const primary = member
    ? { label: "Joined", Icon: Check, onPress: () => setMenu(true), filled: false }
    : requested
      ? { label: "Requested", Icon: X, onPress: () => leave.mutate(), filled: false }
      : { label: g.privacy === "private" ? "Ask to join" : "Join group", Icon: UserPlus, onPress: () => join.mutate(), filled: true };

  return (
    <View style={styles.actions}>
      <Pressable
        onPress={primary.onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={requested ? "Requested. Tap to cancel your request" : member ? "Joined. Options" : primary.label}
        style={({ pressed }) => [styles.action, styles.flex, { backgroundColor: primary.filled ? t.colors.primary : t.colors.muted, opacity: pressed || busy ? 0.75 : 1 }]}
      >
        {busy ? <ActivityIndicator size="small" color={primary.filled ? t.colors.primaryForeground : t.colors.foreground} /> : <primary.Icon size={18} color={primary.filled ? t.colors.primaryForeground : t.colors.foreground} />}
        <Text variant="label" style={{ color: primary.filled ? t.colors.primaryForeground : t.colors.foreground }}>
          {primary.label}
        </Text>
        {member ? <ChevronDown size={16} color={t.colors.foreground} /> : null}
      </Pressable>
      {canInvite(g) ? (
        <Pressable
          onPress={() => router.push(`/g/${g._id}/invite`)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, styles.flex, { backgroundColor: tint(t.colors.primary, 0.12), opacity: pressed ? 0.75 : 1 }]}
        >
          <UserPlus size={18} color={t.colors.primary} />
          <Text variant="label" style={{ color: t.colors.primary }}>
            Invite
          </Text>
        </Pressable>
      ) : null}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        label="Your membership"
        groups={[
          g.isAdmin ? [{ key: "manage", label: "Manage group", hint: "Members, requests and details", Icon: Settings2, onPress: () => router.push(`/g/${g._id}/manage`) }] : [],
          [{ key: "leave", label: "Leave group", Icon: LogOut, destructive: true, onPress: confirmLeave }],
        ].filter((x) => x.length)}
      />
    </View>
  );
}

/** "Write something to the group…", growing into a box with Post. */
function Composer({ groupId }: { groupId: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const body = text.trim();
  const post = useMutation({
    mutationFn: () => createGroupPost(user, groupId, body),
    onSuccess: (created) => {
      setText("");
      client.setQueryData<GroupPost[]>(groupKeys.posts(groupId), (rows) => [created, ...(rows ?? [])]);
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  return (
    <View style={[styles.composer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={36} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write something to the group…"
        placeholderTextColor={t.colors.mutedForeground}
        multiline
        maxLength={4000}
        accessibilityLabel="Write a post to the group"
        style={[styles.composerInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
      />
      {body ? (
        <Pressable onPress={() => post.mutate()} disabled={post.isPending} accessibilityRole="button" accessibilityLabel="Post to the group" style={[styles.send, { backgroundColor: t.colors.primary }]}>
          {post.isPending ? <ActivityIndicator size="small" color={t.colors.primaryForeground} /> : <Send size={17} color={t.colors.primaryForeground} />}
        </Pressable>
      ) : null}
    </View>
  );
}

/** One post in the group. Its author, or a group admin, can delete it. */
function GroupPostCard({ post, group }: { post: GroupPost; group: Group }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const openProfile = useOpenProfile();
  const [menu, setMenu] = useState(false);
  const mine = post.authorUid === user.uid;
  const name = post.author?.displayName ?? "Neighbour";
  const remove = useMutation({
    mutationFn: () => deleteGroupPost(user, group._id, post._id),
    onSuccess: () => {
      client.setQueryData<GroupPost[]>(groupKeys.posts(group._id), (rows) => rows?.filter((p) => p._id !== post._id));
      toast("Post deleted.");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const confirm = () =>
    showDialog(mine ? "Delete your post?" : `Delete ${name}'s post?`, "It will be removed from the group for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  return (
    <View style={[styles.post, { backgroundColor: t.colors.card, opacity: remove.isPending ? 0.5 : 1 }]}>
      <View style={styles.postHead}>
        <Pressable onPress={() => openProfile(post.authorUid)} accessibilityRole="button" accessibilityLabel={`${name}'s profile`} style={styles.author}>
          <Avatar name={name} photoURL={post.author?.photoURL} size={40} />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="muted">
              {timeAgo(post.createdAt)}
            </Text>
          </View>
        </Pressable>
        {mine || group.isAdmin ? <IconButton Icon={MoreHorizontal} label="Post options" onPress={() => setMenu(true)} /> : null}
      </View>
      <SeeMoreText id={`group-post-${post._id}`} text={post.content} lines={8} />
      <ActionSheet visible={menu} onClose={() => setMenu(false)} label="Post options" groups={[[{ key: "delete", label: "Delete post", Icon: Trash2, destructive: true, onPress: confirm }]]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  centre: { textAlign: "center" },
  pad: { paddingHorizontal: 16 },
  headerWrap: { gap: 14, marginBottom: 8 },
  headerText: { gap: 6 },
  description: { marginTop: 4 },
  section: { marginTop: 6 },
  cover: { height: 170, marginHorizontal: 16, marginTop: 12, borderRadius: 20 },
  band: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: MIN_TOUCH, borderRadius: 14, paddingHorizontal: 12 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginHorizontal: 16, padding: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  composerInput: { flex: 1, minHeight: 36, maxHeight: 160, fontSize: 16, paddingVertical: 8, textAlignVertical: "top" },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  separator: { height: 8 },
  post: { padding: 16, gap: 10 },
  postHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  locked: { alignItems: "center", gap: 8, margin: 16, padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  loading: { marginTop: 24 },
});
