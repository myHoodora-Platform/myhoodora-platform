import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { signInWithApple } from "./auth-api";
import { signInFailure } from "./form-errors";

/**
 * Apple's own "Sign in with Apple" / "Continue with Apple" button, for login and sign-up (Apple decides
 * whether the account is new). iPhone only: Apple's rules require their button as-is, black on a light
 * screen and white on a dark one, at least as prominent as other sign-in options.
 */
export function AppleButton({ onError, signUp = false }: { onError: (message: string | null) => void; signUp?: boolean }) {
  const t = useTheme();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    void AppleAuthentication.isAvailableAsync()
      .then((ok) => !cancelled && setAvailable(ok))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const press = async () => {
    if (busy) return;
    onError(null);
    setBusy(true);
    try {
      // On success the root layout moves on when Firebase reports the session; closing Apple's sheet is no error.
      await signInWithApple();
    } catch (err) {
      onError(signInFailure(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={signUp ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={t.scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={t.radius.xl}
        style={styles.button}
        onPress={() => void press()}
      />
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.busy]} pointerEvents="none">
          <ActivityIndicator color={t.scheme === "dark" ? "#000" : "#fff"} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", height: MIN_TOUCH + 4 },
  busy: { alignItems: "flex-end", justifyContent: "center", paddingRight: 16 },
});
