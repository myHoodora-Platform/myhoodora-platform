import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { GoogleSignInUnavailable, signInWithGoogle } from "./auth-api";
import { signInFailure } from "./form-errors";

/** Google's four-colour "G" (Google Identity branding guidelines). */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * "Continue with Google", for both login and sign-up: Google decides whether the account is new.
 * Reports what went wrong through `onError` (the form shows it where its other errors go).
 */
export function GoogleButton({ onError }: { onError: (message: string | null) => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  const press = async () => {
    onError(null);
    setBusy(true);
    try {
      // On success the root layout moves on when Firebase reports the session; nothing to do here.
      await signInWithGoogle();
    } catch (err) {
      onError(err instanceof GoogleSignInUnavailable ? err.message : signInFailure(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ busy }}
      style={({ pressed }) => [styles.button, { borderColor: t.colors.border, backgroundColor: pressed ? t.colors.accent : t.colors.background, borderRadius: t.radius.xl }]}
    >
      {busy ? <ActivityIndicator color={t.colors.foreground} /> : <GoogleG />}
      <Text variant="label" style={styles.label}>
        Continue with Google
      </Text>
    </Pressable>
  );
}

/** "Or continue with": the rule between the form and the alternatives. */
export function OrDivider({ label = "Or continue with" }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.divider} accessibilityRole="text">
      <View style={[styles.rule, { backgroundColor: t.colors.border }]} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View style={[styles.rule, { backgroundColor: t.colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: MIN_TOUCH + 4, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 16 },
  label: { fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
