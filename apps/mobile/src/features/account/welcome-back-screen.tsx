import { errorMessage } from "@myhoodora/api-contract/errors";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { useAuth } from "@/core/auth/auth-provider";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { AUTH_PHOTOS, AuthShell } from "../auth/auth-shell";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

/**
 * Signed in to an account they closed (the "closed" phase): it stays closed until they choose, as on
 * Nextdoor. Reactivating reopens it, or cancels a scheduled deletion; the profile then moves the
 * phone on. As on the web's /welcome-back.
 */
export function WelcomeBackScreen() {
  const { user, profile, reactivate, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const closure = profile?.closure;
  if (!closure) return null;
  const deleting = closure.kind === "deleting";

  const reopen = async () => {
    setBusy(true);
    try {
      await reactivate();
      toast(deleting ? "Deletion cancelled. Welcome back!" : "Your account is open again. Welcome back!", "success");
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(false);
    }
  };

  return (
    <AuthShell
      photo={AUTH_PHOTOS.register}
      title={deleting ? "Your account is being deleted" : "Welcome back"}
      subtitle={
        deleting
          ? `You asked us to delete your account. It will be deleted for good on ${longDate(closure.deleteAt)}, with your posts, listings, comments and profile. Until then you can cancel and keep everything.`
          : `You deactivated your account on ${longDate(closure.since)}. Your profile, posts and listings are hidden until you reactivate it.`
      }
    >
      <Button label={deleting ? "Cancel deletion and keep my account" : "Reactivate my account"} onPress={() => void reopen()} loading={busy} />
      <Button label={deleting ? "Continue deleting and sign out" : "Not now, sign out"} variant="secondary" onPress={() => void logout()} disabled={busy} />
      <Text variant="caption" tone="muted" style={styles.center}>
        Signed in as {user?.email}.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
});
