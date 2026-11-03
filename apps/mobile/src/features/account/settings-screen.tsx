import { DEACTIVATION_REASONS, DELETION_GRACE_DAYS, type CloseMode, type DeactivationReason } from "@myhoodora/api-contract/settings";
import { errorMessage } from "@myhoodora/api-contract/errors";
import Constants from "expo-constants";
import { useRouter } from "@/core/navigation/use-router";
import { BellRing, BookOpen, FileText, HelpCircle, LayoutList, LifeBuoy, LogOut, Lock, MapPinned, MonitorSmartphone, PauseCircle, ShieldCheck, SlidersHorizontal, UserX, Scale, Compass } from "lucide-react-native";
import { useState } from "react";
import {ScrollView, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { openWeb } from "@/shared/utils/open-web";
import { useAppearance } from "@/core/preferences/appearance";
import { usePushSetting } from "@/features/notifications";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Segmented, SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { deactivate } from "./account-api";
import { DiagnosticsGroup } from "./diagnostics-group";
import { replayHomeTour } from "@/features/tour/home-tour";
import { showDialog } from "@/shared/ui/dialog";

const PUSH_LABEL = { granted: "On", denied: "Off", undetermined: "Off", unsupported: "Not available" } as const;

/** `/settings`: everything you can change, grouped the way people look for it. */
export function SettingsScreen() {
  return (
    <AppScreen title="Settings" fallback="/more">
      <SettingsContent />
    </AppScreen>
  );
}

function SettingsContent() {
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const toast = useToast();
  const { profile, logout, logoutEverywhere } = useAuth();
  const push = usePushSetting();
  const { surface, setSurface, theme, setTheme } = useAppearance();
  const [leaving, setLeaving] = useState<CloseMode | null>(null);
  const web = (path: string) => void openWeb(path);

  const confirmLogout = () =>
    showDialog("Log out of myHoodora?", "You'll stay signed in on your other devices.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void logout() },
    ]);

  const confirmEverywhere = () =>
    showDialog("Sign out everywhere?", "You'll be signed out on every phone and browser, this one included.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out everywhere", style: "destructive", onPress: () => void logoutEverywhere().catch((err: unknown) => toast(errorMessage(err), "error")) },
    ]);

  // As on Nextdoor, and as on the web: deactivating is undone by reactivating; deleting is for good.
  const confirmClose = (mode: CloseMode, reason: DeactivationReason) => {
    setLeaving(null);
    const deleting = mode === "delete";
    showDialog(
      deleting ? "Delete your account for good?" : "Deactivate your account?",
      deleting
        ? `Neighbours stop seeing your profile, posts, listings and comments now, and you're signed out everywhere. After ${DELETION_GRACE_DAYS} days we delete them for good, with your photos, address, groups and settings. This can't be undone. Messages you sent stay in the other person's chat, from "Deleted User". Changed your mind? Log in before then and cancel.`
        : "Neighbours stop seeing your profile, posts, listings and comments, you stop getting emails and notifications, and you're signed out everywhere. Nothing is deleted: log in any time and choose Reactivate.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: deleting ? "Delete my account" : "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await deactivate(user, reason, mode);
              await logout();
            } catch (err) {
              toast(errorMessage(err), "error");
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]} scrollIndicatorInsets={{ top: insets.top }}>
      <SettingsGroup>
        <SettingsRow
          leading={<Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={52} />}
          label={profile?.displayName ?? "Your profile"}
          description={profile?.email ?? user.email ?? undefined}
          onPress={() => router.push("/settings/profile")}
        />
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingsRow
          Icon={BellRing}
          label="Notifications on this phone"
          value={push.permission ? PUSH_LABEL[push.permission] : undefined}
          description={push.permission === "denied" ? "Turned off in your phone's Settings" : undefined}
          onPress={push.permission === "granted" || push.permission === "unsupported" ? undefined : () => void push.change()}
        />
        <SettingsRow Icon={SlidersHorizontal} label="What you're notified about" onPress={() => router.push("/settings/notifications")} />
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <View style={styles.choice}>
          <Text variant="label">Theme</Text>
          <Segmented
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
          />
        </View>
        <View style={styles.choice}>
          <Text variant="label">Header and tab bar</Text>
          <Segmented
            label="Header and tab bar"
            value={surface}
            onChange={setSurface}
            options={[
              { id: "glass", label: "Glass" },
              { id: "plain", label: "Plain" },
            ]}
          />
          <Text variant="caption" tone="muted">
            Glass lets what you scroll show through, softly blurred.
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup title="Neighbourhoods">
        <SettingsRow Icon={MapPinned} label="Your neighbourhoods" description="Home, the ones you follow, and your requests" onPress={() => router.push("/settings/neighbourhoods")} />
      </SettingsGroup>

      <SettingsGroup title="Privacy and safety">
        <SettingsRow Icon={Lock} label="Privacy" description="Who sees your profile and who can message you" onPress={() => router.push("/settings/privacy")} />
        <SettingsRow Icon={Scale} label="Decisions & appeals" description="Moderation decisions about you and your reports" onPress={() => router.push("/settings/moderation")} />
        <SettingsRow Icon={ShieldCheck} label="Community guidelines" onPress={() => web("/guidelines")} />
      </SettingsGroup>

      <SettingsGroup title="Help">
        <SettingsRow
          Icon={Compass}
          label="Take the tour again"
          description="A quick look around the app"
          onPress={() => {
            void replayHomeTour(user.uid).then(() => router.navigate("/news-feed"));
          }}
        />
        <SettingsRow Icon={HelpCircle} label="Help centre" onPress={() => router.push("/help")} />
        <SettingsRow Icon={LifeBuoy} label="Contact us" onPress={() => web("/contact")} />
        <SettingsRow Icon={FileText} label="Terms of Use" onPress={() => web("/terms")} />
        <SettingsRow Icon={BookOpen} label="Privacy Policy" onPress={() => web("/privacy")} />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow Icon={LogOut} label="Log out" onPress={confirmLogout} />
        <SettingsRow Icon={MonitorSmartphone} label="Sign out everywhere" description="Every phone and browser, this one included" onPress={confirmEverywhere} />
        <SettingsRow Icon={PauseCircle} label="Deactivate account" description="Take a break. Nothing is deleted" onPress={() => setLeaving("deactivate")} />
        <SettingsRow Icon={UserX} label="Delete account" description={`Deleted for good after ${DELETION_GRACE_DAYS} days`} destructive onPress={() => setLeaving("delete")} />
      </SettingsGroup>

      {__DEV__ || config().qaTools ? (
        <SettingsGroup title="Layouts">
          <SettingsRow Icon={LayoutList} label="Feed layout gallery" description="Made-up posts of every shape" onPress={() => router.push("/qa-feed")} />
        </SettingsGroup>
      ) : null}
      <DiagnosticsGroup />

      <Text variant="caption" tone="muted" style={styles.version}>
        myHoodora {Constants.expoConfig?.version} · {config().appEnv}
      </Text>

      <Sheet visible={leaving !== null} title="Why are you leaving?" onClose={() => setLeaving(null)}>
        {DEACTIVATION_REASONS.map((r) => (
          <SheetItem key={r.id} label={r.label} onPress={() => leaving && confirmClose(leaving, r.id)} />
        ))}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 22 },
  choice: { padding: 14, gap: 10 },
  version: { textAlign: "center" },
});
