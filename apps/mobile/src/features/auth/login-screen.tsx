import { loginSchema } from "@myhoodora/api-contract/auth-validation";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, type TextInput } from "react-native";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { signIn } from "./auth-api";
import { AUTH_PHOTOS, AuthShell } from "./auth-shell";
import { FooterLink } from "./footer-link";
import { GoogleButton, OrDivider } from "./google-button";
import { fieldErrors, signInFailure } from "./form-errors";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const inFlight = useRef(false);

  const submit = async () => {
    // One account request at a time: a second tap before the first re-render would ask Firebase twice
    // (and a duplicate sign-up comes back as "email already in use" after the first succeeded).
    if (inFlight.current) return;
    const problems = fieldErrors(loginSchema, { email: email.trim(), password });
    setErrors(problems);
    setFailure(null);
    if (problems) return;
    setBusy(true);
    inFlight.current = true;
    try {
      // The root layout moves on once Firebase reports the new session.
      await signIn(email, password);
    } catch (err) {
      setFailure(signInFailure(err));
      setBusy(false);
      inFlight.current = false;
    }
  };

  return (
    <AuthShell photo={AUTH_PHOTOS.login} title="Welcome back, neighbour!" subtitle="Log in to see what's happening in your neighbourhood.">
      <TextField
        label="Email address"
        placeholder="Enter your email"
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
        label="Password"
        placeholder="Enter your password"
        password
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setErrors((e) => (e ? { ...e, password: undefined } : e));
        }}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={errors?.password}
      />
      <Link href="/forgot-password" asChild>
        <Pressable accessibilityRole="link" style={styles.forgot} hitSlop={8}>
          <Text variant="label">Forgot password?</Text>
        </Pressable>
      </Link>
      {failure ? <InlineAlert>{failure}</InlineAlert> : null}
      <Button label="Log in" onPress={submit} loading={busy} />
      <OrDivider label={"Or continue with"} />
      <GoogleButton onError={setFailure} />
      <FooterLink question="New to myHoodora?" action="Join now" href="/register" replace />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: "flex-end" },
});
