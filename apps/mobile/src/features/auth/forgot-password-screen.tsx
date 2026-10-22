import { forgotPasswordSchema } from "@myhoodora/api-contract/auth-validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { TextField } from "@/shared/ui/text-field";
import { resetPassword } from "./auth-api";
import { AUTH_PHOTOS, AuthShell } from "./auth-shell";
import { fieldErrors, signInFailure } from "./form-errors";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problems = fieldErrors(forgotPasswordSchema, { email: email.trim() });
    setError(problems?.email ?? null);
    if (problems) return;
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      // Firebase doesn't say whether an account exists for "user not found"; neither do we.
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") setSent(true);
      else setError(signInFailure(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell photo={AUTH_PHOTOS.reset} title="Check your email" subtitle={`If there's an account for ${email.trim()}, we've sent a link to choose a new password.`}>
        <Button label="Back to log in" onPress={() => router.replace("/login")} />
      </AuthShell>
    );
  }

  return (
    <AuthShell photo={AUTH_PHOTOS.reset} title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <TextField
        label="Email address"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={error}
      />
      <Button label="Send reset link" onPress={submit} loading={busy} />
    </AuthShell>
  );
}
