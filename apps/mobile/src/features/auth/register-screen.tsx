import { registerSchema } from "@myhoodora/api-contract/auth-validation";
import { useRef, useState } from "react";
import { StyleSheet, Switch, View, type TextInput } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { signUp } from "./auth-api";
import { AUTH_PHOTOS, AuthShell } from "./auth-shell";
import { FooterLink } from "./footer-link";
import { GoogleButton, OrDivider } from "./google-button";
import { fieldErrors, signInFailure } from "./form-errors";
import { openWeb } from "@/shared/utils/open-web";

type Errors = { email?: string; password?: string; confirm?: string; agreeToTerms?: string };

export function RegisterScreen() {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreeToTerms, setAgree] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const inFlight = useRef(false);
  const confirmRef = useRef<TextInput>(null);

  const submit = async () => {
    // One account request at a time: a second tap before the first re-render would ask Firebase twice
    // (and a duplicate sign-up comes back as "email already in use" after the first succeeded).
    if (inFlight.current) return;
    // The web's rules, plus the retype check this form adds (a phone keyboard makes typos easy).
    const problems: Errors = { ...fieldErrors(registerSchema, { email: email.trim(), password, agreeToTerms }) };
    if (!problems.password && confirm !== password) problems.confirm = "Passwords don't match.";
    const failed = Object.keys(problems).length > 0;
    setErrors(failed ? problems : null);
    setFailure(null);
    if (failed) return;
    setBusy(true);
    inFlight.current = true;
    try {
      // A new account goes to onboarding next: the profile says it isn't onboarded yet.
      await signUp(email, password);
    } catch (err) {
      setFailure(signInFailure(err));
      setBusy(false);
      inFlight.current = false;
    }
  };

  const open = (path: string) => void openWeb(path);

  return (
    <AuthShell photo={AUTH_PHOTOS.register} title="Join your neighbourhood" subtitle="Create your account, then confirm where you live.">
      <TextField
        label="Email address"
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
        label="Create a password"
        placeholder="At least 8 characters"
        password
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setErrors((e) => (e ? { ...e, password: undefined } : e));
        }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={errors?.password}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        placeholder="Re-type your password"
        password
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setErrors((e) => (e ? { ...e, confirm: undefined } : e));
        }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={errors?.confirm}
      />
      <View style={styles.row}>
        <Switch
          value={agreeToTerms}
          onValueChange={setAgree}
          accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
          trackColor={{ true: t.colors.primary, false: t.colors.input }}
        />
        <Text variant="caption" style={styles.flex}>
          I agree to the{" "}
          <Text variant="caption" tone="primary" onPress={() => open("/terms")} accessibilityRole="link">
            Terms of Use
          </Text>{" "}
          and{" "}
          <Text variant="caption" tone="primary" onPress={() => open("/privacy")} accessibilityRole="link">
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      {errors?.agreeToTerms ? <InlineAlert>{errors.agreeToTerms}</InlineAlert> : null}
      {failure ? <InlineAlert>{failure}</InlineAlert> : null}
      <Button label="Create account" onPress={submit} loading={busy} />
      <OrDivider label={"Or sign up with"} />
      <GoogleButton onError={setFailure} />
      <FooterLink question="Already a member?" action="Log in" href="/login" replace />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
