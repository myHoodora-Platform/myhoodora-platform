import { errorMessage } from "@myhoodora/api-contract/errors";
import { MAX_GROUP_MEMBERS, type Conversation } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, LogOut, MessageCircle, Pencil, ShieldOff, UserMinus, UserPlus, Users } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { showDialog } from "@/shared/ui/dialog";
import { ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import {
  addGroupMembers,
  chatKeys,
  createGroupChat,
  getConversation,
  leaveGroupChat,
  removeGroupMember,
  renameGroupChat,
  setGroupAdmin,
  startConversation,
} from "./chat-api";
import { PeoplePicker, type PickedPerson } from "./people-picker";

/**
 * `/inbox/new-group`: WhatsApp's "New group". Choose neighbours (up to 49, who accept messages from
 * you), name it, create. You're its admin.
 */
export function NewGroupScreen() {
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const name = title.trim();
  const create = async () => {
    if (!name || !picked.length || saving) return;
    setSaving(true);
    try {
      const c = await createGroupChat(user, name, picked.map((p) => p.uid));
      void client.invalidateQueries({ queryKey: chatKeys.all });
      router.replace(`/inbox/${c._id}`);
    } catch (err) {
      // The API names anyone who can't be added: they can be taken out and it tried again.
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  };
  return (
    <AppScreen
      title="New group"
      fallback="/inbox"
      canvas={false}
      footer={
        <View style={styles.footer}>
          <Button label={saving ? "Creating…" : picked.length ? `Create group with ${picked.length + 1}` : "Create group"} onPress={() => void create()} disabled={!name || !picked.length || saving} loading={saving} />
        </View>
      }
    >
      <Picker
        picked={picked}
        onChange={setPicked}
        max={MAX_GROUP_MEMBERS - 1}
        header={<TextField label="Group name" value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. Road 4 neighbours" autoFocus returnKeyType="next" />}
      />
    </AppScreen>
  );
}

/** Inside AppScreen, so it can clear the header (useScreenInsets). */
function Picker(props: Omit<React.ComponentProps<typeof PeoplePicker>, "paddingBottom">) {
  const insets = useScreenInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 12 }]}>
      <PeoplePicker {...props} paddingBottom={insets.bottom + 24} />
    </View>
  );
}

/** `/inbox/<id>/add`: add people to your group (admins). */
export function AddPeopleScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const convo = useQuery({ queryKey: chatKeys.one(id), queryFn: () => getConversation(user, id) });
  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const inIt = convo.data?.participantUids ?? [];
  const add = async () => {
    if (!picked.length || saving) return;
    setSaving(true);
    try {
      const c = await addGroupMembers(user, id, picked.map((p) => p.uid));
      client.setQueryData(chatKeys.one(id), c);
      void client.invalidateQueries({ queryKey: chatKeys.messages(id) });
      toast(picked.length > 1 ? `Added ${picked.length} people.` : `Added ${picked[0]!.displayName}.`);
      router.back();
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  };
  return (
    <AppScreen
      title="Add people"
      fallback="/inbox"
      canvas={false}
      footer={
        <View style={styles.footer}>
          <Button label={picked.length ? `Add ${picked.length}` : "Add"} onPress={() => void add()} disabled={!picked.length || saving} loading={saving} />
        </View>
      }
    >
      {convo.data ? <Picker picked={picked} onChange={setPicked} max={Math.max(0, MAX_GROUP_MEMBERS - inIt.length)} exclude={inIt} /> : <LoadingState label="Loading the group" />}
    </AppScreen>
  );
}

/**
 * `/inbox/<id>/info`: a group's name and members. Admins rename it, add and remove people and make
 * admins; anyone can message a member or leave. A community Group's chat follows the Group's members.
 */
export function GroupInfoScreen({ id }: { id: string }) {
  return (
    <AppScreen title="Group info" fallback="/inbox" canvas={false}>
      <GroupInfo id={id} />
    </AppScreen>
  );
}

function GroupInfo({ id }: { id: string }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const convo = useQuery({ queryKey: chatKeys.one(id), queryFn: () => getConversation(user, id) });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<string | null>(null);
  if (convo.isPending) return <LoadingState label="Loading the group" />;
  if (!convo.data) return <ErrorState error={convo.error} onRetry={() => void convo.refetch()} />;
  const c = convo.data;
  const admins = c.admins ?? [];
  const amAdmin = admins.includes(user.uid);
  const adHoc = !c.groupId;
  const people = [...(c.participants ?? [])].sort((a, b) => Number(admins.includes(b.uid)) - Number(admins.includes(a.uid)) || (a.uid === user.uid ? -1 : b.uid === user.uid ? 1 : a.displayName.localeCompare(b.displayName)));
  const chosen = people.find((p) => p.uid === member);

  const run = async (work: () => Promise<Conversation | void>, done?: string) => {
    setBusy(true);
    try {
      const next = await work();
      if (next) client.setQueryData(chatKeys.one(id), next);
      void client.invalidateQueries({ queryKey: chatKeys.all });
      if (done) toast(done);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  const saveName = () => {
    const name = renaming?.trim();
    setRenaming(null);
    if (name && name !== c.title) void run(() => renameGroupChat(user, id, name), "Renamed.");
  };
  const leave = () =>
    showDialog(`Leave “${c.title}”?`, "You'll stop getting its messages. Someone in it can add you again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void leaveGroupChat(user, id).then(
            () => {
              void client.invalidateQueries({ queryKey: chatKeys.all });
              router.replace("/inbox");
            },
            (err) => toast(errorMessage(err), "error"),
          ),
      },
    ]);
  const messageThem = async (uid: string) => {
    try {
      const d = await startConversation(user, uid);
      router.push(`/inbox/${d._id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <>
    <FlatList
      data={people}
      keyExtractor={(p) => p.uid}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <View style={styles.head}>
          <View style={[styles.bigAvatar, { backgroundColor: tint(t.colors.primary, 0.1) }]}>
            <Users size={36} color={t.colors.primary} />
          </View>
          {renaming !== null ? (
            <View style={styles.rename}>
              <TextField label="Group name" value={renaming} onChangeText={setRenaming} maxLength={60} autoFocus onSubmitEditing={saveName} returnKeyType="done" />
              <Button label="Save" onPress={saveName} disabled={!renaming.trim()} />
            </View>
          ) : (
            <Pressable onPress={() => amAdmin && adHoc && setRenaming(c.title ?? "")} disabled={!amAdmin || !adHoc} accessibilityRole={amAdmin && adHoc ? "button" : "text"} accessibilityHint={amAdmin && adHoc ? "Rename the group" : undefined} style={styles.titleRow}>
              <Text variant="title" style={styles.center}>
                {c.title}
              </Text>
              {amAdmin && adHoc ? <Pencil size={16} color={t.colors.mutedForeground} /> : null}
            </Pressable>
          )}
          <Text tone="muted" style={styles.center}>
            Group · {people.length} {people.length === 1 ? "person" : "people"}
          </Text>
          {c.groupId ? (
            <Text variant="caption" tone="muted" style={styles.center}>
              Everyone in the group is in this chat: people join or leave it with the group.
            </Text>
          ) : null}
          {amAdmin && adHoc && people.length < MAX_GROUP_MEMBERS ? (
            <Pressable onPress={() => router.push({ pathname: "/inbox/[id]/add", params: { id } })} accessibilityRole="button" style={({ pressed }) => [styles.add, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}>
              <View style={[styles.addIcon, { backgroundColor: t.colors.primary }]}>
                <UserPlus size={20} color={t.colors.primaryForeground} />
              </View>
              <Text variant="label" tone="primary">
                Add people
              </Text>
            </Pressable>
          ) : null}
          <Text variant="caption" tone="muted" style={styles.section}>
            {people.length} {people.length === 1 ? "person" : "people"}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => item.uid !== user.uid && setMember(item.uid)}
          disabled={item.uid === user.uid || busy}
          accessibilityRole="button"
          accessibilityLabel={`${item.uid === user.uid ? "You" : item.displayName}${admins.includes(item.uid) ? ", group admin" : ""}`}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
        >
          <Avatar name={item.displayName} photoURL={item.photoURL} size={44} />
          <Text variant="label" numberOfLines={1} style={styles.flex}>
            {item.uid === user.uid ? "You" : item.displayName}
          </Text>
          {admins.includes(item.uid) ? (
            <View style={[styles.badge, { backgroundColor: tint(t.colors.primary, 0.1) }]}>
              <Text variant="caption" tone="primary">
                Group admin
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}
      ListFooterComponent={
        adHoc ? (
          <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.add, styles.leave, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}>
            {busy ? <ActivityIndicator color={t.colors.destructive} /> : <LogOut size={22} color={t.colors.destructive} />}
            <Text variant="label" style={{ color: t.colors.destructive }}>
              Leave group
            </Text>
          </Pressable>
        ) : null
      }
    />
    <ActionSheet
      visible={!!chosen}
      onClose={() => setMember(null)}
      label={chosen?.displayName ?? "Member"}
      title={chosen?.displayName}
      groups={[
        [{ key: "message", label: `Message ${chosen?.displayName.split(" ")[0] ?? ""}`, Icon: MessageCircle, onPress: () => chosen && void messageThem(chosen.uid) }],
        ...(amAdmin && adHoc && chosen
          ? [
              [
                admins.includes(chosen.uid)
                  ? { key: "unadmin", label: "Dismiss as admin", Icon: ShieldOff, onPress: () => void run(() => setGroupAdmin(user, id, chosen.uid, false), `${chosen.displayName} is no longer an admin.`) }
                  : { key: "admin", label: "Make group admin", hint: "Admins add and remove people and rename the group", Icon: Crown, onPress: () => void run(() => setGroupAdmin(user, id, chosen.uid, true), `${chosen.displayName} is now an admin.`) },
                {
                  key: "remove",
                  label: "Remove from group",
                  Icon: UserMinus,
                  destructive: true,
                  onPress: () =>
                    setTimeout(
                      () =>
                        showDialog(`Remove ${chosen.displayName}?`, "They'll stop getting this group's messages. The group sees that you removed them.", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Remove", style: "destructive", onPress: () => void run(() => removeGroupMember(user, id, chosen.uid), `Removed ${chosen.displayName}.`) },
                        ]),
                      300,
                    ),
                },
              ],
            ]
          : []),
      ]}
    />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  footer: { padding: 16 },
  head: { alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rename: { alignSelf: "stretch", gap: 8 },
  add: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch", paddingVertical: 10, borderRadius: 12, minHeight: MIN_TOUCH + 8 },
  addIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  leave: { paddingHorizontal: 16, marginTop: 16 },
  section: { alignSelf: "flex-start", textTransform: "uppercase", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: MIN_TOUCH + 12 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
