import { errorMessage } from "@myhoodora/api-contract/errors";
import { NOTIFICATION_CATEGORIES, type Preferences } from "@myhoodora/api-contract/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { feedKeys } from "@/features/feed/feed-api";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Segmented, SettingsGroup, SettingsRow, SettingsSwitch } from "@/shared/ui/settings";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { accountKeys, listBlocks, unblockUser } from "./account-api";
import { blockedNames, forgetBlocked } from "./blocked-names";
import { usePreferences } from "./use-preferences";

/** Loads the preferences, then shows the page. Shared by both screens below. */
function PreferencesPage({ title, children }: { title: string; children: (prefs: Preferences, change: ReturnType<typeof usePreferences>["change"]) => ReactNode }) {
  return (
    <AppScreen title={title} fallback="/settings">
      <PreferencesBody>{children}</PreferencesBody>
    </AppScreen>
  );
}

function PreferencesBody({ children }: { children: (prefs: Preferences, change: ReturnType<typeof usePreferences>["change"]) => ReactNode }) {
  const insets = useScreenInsets();
  const { prefs, change } = usePreferences();
  const padding = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 };
  if (prefs.isPending) {
    return (
      <View style={[styles.content, padding]} accessible accessibilityLabel="Loading your settings">
        <Skeleton height={180} radius={20} />
        <Skeleton height={120} radius={20} />
      </View>
    );
  }
  if (!prefs.data) return <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} title="Couldn't load your settings" />;
  return (
    <ScrollView contentContainerStyle={[styles.content, padding]} scrollIndicatorInsets={{ top: insets.top }}>
      {children(prefs.data, change)}
    </ScrollView>
  );
}

/** `/settings/notifications`: what reaches you, by push and by email. */
export function NotificationSettingsScreen() {
  return (
    <PreferencesPage title="Notifications">
      {(prefs, change) => (
        <>
          <SettingsGroup title="Push notifications" footer="Urgent alerts always reach you: they're about safety.">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <SettingsSwitch
                key={c.id}
                label={c.label}
                description={c.description}
                value={c.id === "urgent_alerts" ? true : prefs.notifications[c.id].push}
                disabled={c.id === "urgent_alerts"}
                onChange={(push) => change({ notifications: { [c.id]: { push } } })}
              />
            ))}
          </SettingsGroup>
          <SettingsGroup title="Email">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <SettingsSwitch key={c.id} label={c.label} value={prefs.notifications[c.id].email} onChange={(email) => change({ notifications: { [c.id]: { email } } })} />
            ))}
          </SettingsGroup>
          <SettingsGroup title="Neighbourhood digest" footer="A summary email of what happened nearby.">
            <View style={styles.choice}>
              <Segmented
                label="Digest"
                value={prefs.digest}
                onChange={(digest) => change({ digest })}
                options={[
                  { id: "daily", label: "Daily" },
                  { id: "weekly", label: "Weekly" },
                  { id: "off", label: "Off" },
                ]}
              />
            </View>
          </SettingsGroup>
        </>
      )}
    </PreferencesPage>
  );
}

/** A choice among a few, as rows with a tick (clearer than a dropdown on a phone). */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return <SettingsRow label={label} onPress={onPress} right={selected ? <Check size={20} color={t.colors.primary} accessibilityLabel="Selected" /> : <View style={styles.tickSpace} />} />;
}

/** `/settings/privacy`: who sees your profile and who can message you. Your address is never shown. */
export function PrivacySettingsScreen() {
  return (
    <PreferencesPage title="Privacy">
      {(prefs, change) => (
        <>
          <Text variant="caption" tone="muted" style={styles.note}>
            Your exact address is never shown to anyone. Neighbours only see your neighbourhood&apos;s name.
          </Text>
          <SettingsGroup title="Who can see your full profile">
            <Choice label="My neighbourhood" selected={prefs.privacy.profileVisibility === "neighbourhood"} onPress={() => change({ privacy: { profileVisibility: "neighbourhood" } })} />
            <Choice label="Nearby neighbourhoods too" selected={prefs.privacy.profileVisibility === "nearby"} onPress={() => change({ privacy: { profileVisibility: "nearby" } })} />
          </SettingsGroup>
          <SettingsGroup title="Who can message you">
            <Choice label="Anyone in my neighbourhood" selected={prefs.privacy.messaging === "neighbourhood"} onPress={() => change({ privacy: { messaging: "neighbourhood" } })} />
            <Choice label="Only people I've messaged" selected={prefs.privacy.messaging === "contacts"} onPress={() => change({ privacy: { messaging: "contacts" } })} />
            <Choice label="No one" selected={prefs.privacy.messaging === "nobody"} onPress={() => change({ privacy: { messaging: "nobody" } })} />
          </SettingsGroup>
          <SettingsGroup footer="Helps neighbours trust newer and long-time residents alike.">
            <SettingsSwitch label="Show “Neighbour since” on your profile" value={prefs.privacy.showNeighbourSince} onChange={(showNeighbourSince) => change({ privacy: { showNeighbourSince } })} />
          </SettingsGroup>
          <BlockedGroup />
        </>
      )}
    </PreferencesPage>
  );
}

/** Who you've blocked, each with Unblock. Block someone from their profile's ⋯ menu. */
function BlockedGroup() {
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const blocked = useQuery({
    queryKey: accountKeys.blocks,
    queryFn: async () => {
      const [uids, names] = await Promise.all([listBlocks(user), blockedNames()]);
      return uids.map((uid) => ({ uid, ...(names[uid] ?? { name: "A neighbour you blocked" }) }));
    },
  });

  const unblock = async (uid: string, name: string) => {
    setBusy(uid);
    try {
      await unblockUser(user, uid);
      await forgetBlocked(uid);
      client.setQueryData<{ uid: string }[]>(accountKeys.blocks, (rows) => rows?.filter((r) => r.uid !== uid));
      void client.invalidateQueries({ queryKey: feedKeys.all });
      toast(`${name} is unblocked.`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const footer = "Blocked neighbours can't message you or see your posts, and you won't see theirs. They aren't told.";
  if (blocked.isPending) return <Skeleton height={64} radius={20} />;
  if (!blocked.data?.length) {
    return (
      <SettingsGroup title="Blocked neighbours" footer={footer}>
        <SettingsRow label={blocked.isError ? "Couldn't load who you've blocked" : "You haven't blocked anyone"} description={blocked.isError ? undefined : "You can block someone from their profile."} />
      </SettingsGroup>
    );
  }
  return (
    <SettingsGroup title="Blocked neighbours" footer={footer}>
      {blocked.data.map((b) => (
        <SettingsRow
          key={b.uid}
          label={b.name}
          leading={<Avatar name={b.name} photoURL={b.photoURL ?? undefined} size={36} />}
          right={
            <Button label="Unblock" variant="secondary" loading={busy === b.uid} disabled={busy !== null} onPress={() => void unblock(b.uid, b.name)} accessibilityLabel={`Unblock ${b.name}`} style={styles.unblock} />
          }
        />
      ))}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 22 },
  choice: { padding: 14 },
  note: { paddingHorizontal: 16 },
  tickSpace: { width: 20 },
  unblock: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14 },
});
