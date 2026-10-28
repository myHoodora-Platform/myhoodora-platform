import { EmailAuthProvider, reauthenticateWithCredential } from "@firebase/auth";
import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import { useRouter } from "@/core/navigation/use-router";
import { MailCheck } from "lucide-react-native";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { z } from "zod";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { signInFailure } from "@/features/auth/form-errors";
import { tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { changeEmail } from "./account-api";
import { canChangeEmail } from "./account-rules";
import { FormScrollView } from "@/shared/ui/form-scroll-view";

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);

/**
 * `/settings/email`: fix an email that was never confirmed (a typo at sign-up, an inbox they can't
 * reach). The password is asked again so an unlocked phone can't be used to take the account; the
 * new address gets its own link, and the old one's links stop working.
 */
export function ChangeEmailScreen() {
  return (
    <AppScreen title="Change email" fallback="/settings/profile">
      <ChangeEmailContent />
    </AppScreen>
  );
}

function ChangeEmailContent() {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const { profile, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const inFlight = useRef(false);
  const current = profile?.email ?? user.email ?? "";
  const allowed = canChangeEmail(profile, user.providerData.map((p) => p.providerId));

  const submit = async () => {
    if (inFlight.current) return;
    const parsed = emailSchema.safeParse(email);
    const found: { email?: string; password?: string } = {};
    if (!parsed.success) found.email = parsed.error.issues[0]?.message;
    else if (parsed.data.toLowerCase() === current.toLowerCase()) found.email = "That's already your email address.";
    if (!password) found.password = "Enter your password.";
    setErrors(Object.keys(found).length ? found : null);
    setProblem(null);
    if (Object.keys(found).length || !parsed.success) return;
    inFlight.current = true;
    setBusy(true);
    try {
      // Proves it's them, and gives the API the recent sign-in it asks for.
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(current, password));
      } catch (err) {
        setErrors({ password: signInFailure(err) });
        return;
      }
      await changeEmail(user, parsed.data);
      // Firebase holds the new address now: pick it up, then the profile.
      await user.reload().catch(() => undefined);
      await user.getIdToken(true).catch(() => undefined);
      await refreshProfile();
      setSentTo(parsed.data.toLowerCase());
    } catch (err) {
      // A 409 is about the address (another account has it): say it on the field, where the fix is.
      if (err instanceof ApiError && err.status === 409) setErrors({ email: err.message });
      else setProblem(err instanceof ApiError && (err.kind === "client" || err.kind === "forbidden") ? err.message : errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const padding = { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 };

  if (sentTo) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.centre, padding]}>
        <View style={[styles.badge, { backgroundColor: tint(t.colors.primary) }]}>
          <MailCheck size={34} color={t.colors.primary} />
        </View>
        <Text variant="title" style={styles.centredText}>
          Check your inbox
        </Text>
        <Text tone="muted" style={styles.centredText}>
          {`Your email is now ${sentTo}. We sent a link there: open it to confirm the address. Links sent to your old address no longer work.`}
        </Text>
        <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings/profile"))} />
      </ScrollView>
    );
  }

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={[styles.content, padding]}>
        <InlineAlert tone="info">
          {profile?.emailVerified
            ? "Your email is confirmed, so it can't be changed. It's how we know this account is yours."
            : "Your email comes from the account you sign in with (such as Google), so it can't be changed here."}
        </InlineAlert>
      </ScrollView>
    );
  }

  return (
    <FormScrollView contentContainerStyle={[styles.content, padding]} keyboardShouldPersistTaps="handled">
      <Text tone="muted">
        {`Your email (${current}) isn't confirmed yet, so you can change it. Once an address is confirmed, it can't be changed.`}
      </Text>
      {problem ? <InlineAlert>{problem}</InlineAlert> : null}
      <TextField
        label="New email address"
        placeholder="name@example.com"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setErrors((e) => (e ? { ...e, email: undefined } : e));
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors?.email}
      />
      <TextField
        ref={passwordRef}
        label="Your password"
        hint="To check it's really you."
        password
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setErrors((e) => (e ? { ...e, password: undefined } : e));
        }}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={errors?.password}
      />
      <Button label="Change email" onPress={() => void submit()} loading={busy} />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  centre: { alignItems: "stretch" },
  centredText: { textAlign: "center" },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", alignSelf: "center" },
});
