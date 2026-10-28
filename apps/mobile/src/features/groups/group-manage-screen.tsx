import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Group, GroupJoinRequest, GroupMember } from "@myhoodora/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, MoreHorizontal, Pencil, Shield, ShieldOff, Trash2, UserMinus, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { usePullRefresh } from "@/shared/hooks/use-pull-refresh";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { timeAgo } from "@/shared/utils/time";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { answerRequest, deleteGroup, getGroup, groupKeys, listMembers, listRequests, removeMember, setMemberRole } from "./groups-api";
import { shareInvite } from "./group-invite-screen";

/** `/g/<id>/manage` (admins): who's waiting, who's in, the details, the invite link, and deleting. */
export function GroupManageScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const group = useQuery({ queryKey: groupKeys.one(id), queryFn: () => getGroup(user, id) });
  return (
    <AppScreen title="Manage group" fallback={`/g/${id}`}>
      {group.data ? <Manage group={group.data} /> : group.isPending ? <LoadingState /> : <ErrorState error={group.error} onRetry={() => void group.refetch()} />}
    </AppScreen>
  );
}

function Manage({ group: g }: { group: Group }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  // Always fresh: admins arrive here from a "wants to join" notification.
  const members = useQuery({ queryKey: groupKeys.members(g._id), queryFn: () => listMembers(user, g._id), staleTime: 0 });
  const requests = useQuery({ queryKey: groupKeys.requests(g._id), queryFn: () => listRequests(user, g._id), enabled: g.isAdmin, staleTime: 0 });
  const pull = usePullRefresh(() => Promise.all([members.refetch(), requests.refetch()]));

  const remove = useMutation({
    mutationFn: () => deleteGroup(user, g._id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: groupKeys.all });
      toast(`${g.name} was deleted.`);
      router.replace("/groups");
    },
    // 409 once anyone else has posted (Nextdoor's rule).
    onError: (err) => Alert.alert("Couldn't delete the group", errorMessage(err)),
  });
  const confirmDelete = () =>
    Alert.alert(`Delete ${g.name}?`, "The group and its posts are removed for everyone. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);

  if (!g.isAdmin) return <ErrorState error={new Error("Only the group's admins can manage it.")} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} tintColor={t.colors.primary} colors={[t.colors.primary]} progressViewOffset={insets.top} />}
    >
      {g.privacy === "private" ? (
        <SettingsGroup title={`Asking to join${requests.data?.length ? ` (${requests.data.length})` : ""}`} footer="Declining doesn't tell them why.">
          {requests.data?.length ? (
            requests.data.map((r) => <RequestRow key={r.uid} groupId={g._id} request={r} />)
          ) : (
            <View style={styles.empty}>
              <Text tone="muted">{requests.isPending ? "Loading…" : requests.isError ? "Couldn't load requests. Pull down to try again." : "Nobody is waiting."}</Text>
            </View>
          )}
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={`Members${members.data ? ` (${members.data.length})` : ""}`}>
        {members.data?.length ? (
          members.data.map((m) => <MemberRow key={m.uid} group={g} member={m} />)
        ) : (
          <View style={styles.empty}>
            <Text tone="muted">{members.isPending ? "Loading…" : "Couldn't load members."}</Text>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup title="Group">
        <SettingsRow Icon={Pencil} label="Edit details" description="Name, description, cover, who can join" onPress={() => router.push(`/g/${g._id}/edit`)} />
        <SettingsRow Icon={UserPlus} label="Invite neighbours" onPress={() => router.push(`/g/${g._id}/invite`)} />
        <SettingsRow Icon={Link2} label="Share invite link" description={g.privacy === "private" ? "Anyone with the link joins without asking" : "Send it on WhatsApp or by text"} onPress={() => void shareInvite(user, g, toast)} />
      </SettingsGroup>

      <SettingsGroup footer="You can delete a group until someone else has posted in it.">
        <SettingsRow Icon={Trash2} label="Delete group" destructive onPress={confirmDelete} />
      </SettingsGroup>
    </ScrollView>
  );
}

function Person({ name, photoURL, line, uid, you = false }: { name: string; photoURL?: string; line: string; uid: string; you?: boolean }) {
  const openProfile = useOpenProfile();
  const label = you ? `${name} (you)` : name;
  return (
    <Pressable onPress={() => openProfile(uid)} accessibilityRole="button" accessibilityLabel={`${label}. ${line}`} style={styles.person}>
      <Avatar name={name} photoURL={photoURL} size={40} />
      <View style={styles.flex}>
        <Text variant="label" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

function RequestRow({ groupId, request: r }: { groupId: string; request: GroupJoinRequest }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const name = r.displayName ?? "A neighbour";
  const answer = useMutation({
    mutationFn: (approve: boolean) => answerRequest(user, groupId, r.uid, approve),
    onSuccess: (_, approve) => {
      client.setQueryData<GroupJoinRequest[]>(groupKeys.requests(groupId), (rows) => rows?.filter((x) => x.uid !== r.uid));
      void client.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      void client.invalidateQueries({ queryKey: groupKeys.one(groupId) });
      toast(approve ? `${name} joined the group.` : "Request declined.");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  return (
    <View style={[styles.row, { opacity: answer.isPending ? 0.5 : 1 }]}>
      <Person uid={r.uid} name={name} photoURL={r.photoURL} line={`Asked ${timeAgo(r.requestedAt)}`} />
      <View style={styles.buttons}>
        <Pressable onPress={() => answer.mutate(false)} disabled={answer.isPending} accessibilityRole="button" accessibilityLabel={`Decline ${name}`} style={[styles.pill, { backgroundColor: t.colors.muted }]}>
          <Text variant="label">Decline</Text>
        </Pressable>
        <Pressable onPress={() => answer.mutate(true)} disabled={answer.isPending} accessibilityRole="button" accessibilityLabel={`Approve ${name}`} style={[styles.pill, { backgroundColor: t.colors.primary }]}>
          <Text variant="label" style={{ color: t.colors.primaryForeground }}>
            Approve
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A member; tap ⋯ to make or unmake an admin, or remove them (with an optional reason they're told). */
function MemberRow({ group: g, member: m }: { group: Group; member: GroupMember }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const me = m.uid === user.uid;
  const name = m.displayName ?? "Neighbour";
  const refresh = () => {
    void client.invalidateQueries({ queryKey: groupKeys.members(g._id) });
    void client.invalidateQueries({ queryKey: groupKeys.one(g._id) });
  };
  const role = useMutation({
    mutationFn: (next: GroupMember["role"]) => setMemberRole(user, g._id, m.uid, next),
    onSuccess: (_, next) => {
      refresh();
      toast(next === "admin" ? `${name} is now an admin.` : `${name} is no longer an admin.`);
    },
    onError: (err) => Alert.alert("Couldn't change that", errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (reason?: string) => removeMember(user, g._id, m.uid, reason),
    onSuccess: () => {
      client.setQueryData<GroupMember[]>(groupKeys.members(g._id), (rows) => rows?.filter((x) => x.uid !== m.uid));
      refresh();
      toast(`${name} was removed.`);
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  // A reason is optional; Alert.prompt exists only on iOS, so Android offers a few common ones.
  const confirmRemove = () =>
    Alert.alert(`Remove ${name}?`, "They'll be told, with the reason if you give one.", [
      { text: "Cancel", style: "cancel" },
      { text: "Not following the group's rules", onPress: () => remove.mutate("Not following the group's rules") },
      { text: "Remove without a reason", style: "destructive", onPress: () => remove.mutate(undefined) },
    ]);

  return (
    <View style={[styles.row, { opacity: role.isPending || remove.isPending ? 0.5 : 1 }]}>
      <Person uid={m.uid} name={name} you={me} photoURL={m.photoURL} line={`Joined ${timeAgo(m.joinedAt)}`} />
      {m.role === "admin" ? (
        <View style={[styles.badge, { backgroundColor: tint(t.colors.primary, 0.12) }]}>
          <Text variant="caption" style={{ color: t.colors.primary }}>
            Admin
          </Text>
        </View>
      ) : null}
      {!me ? (
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={`Options for ${name}`} hitSlop={6} style={styles.more}>
          <MoreHorizontal size={22} color={t.colors.mutedForeground} />
        </Pressable>
      ) : null}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        label={`Options for ${name}`}
        groups={[
          [
            m.role === "admin"
              ? { key: "demote", label: "Remove as admin", Icon: ShieldOff, onPress: () => role.mutate("member") }
              : { key: "promote", label: "Make admin", hint: "They can approve, remove and edit too", Icon: Shield, onPress: () => role.mutate("admin") },
          ],
          [{ key: "remove", label: "Remove from group", Icon: UserMinus, destructive: true, onPress: confirmRemove }],
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 22 },
  empty: { padding: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: MIN_TOUCH },
  buttons: { flexDirection: "row", gap: 6 },
  pill: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  more: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
});
