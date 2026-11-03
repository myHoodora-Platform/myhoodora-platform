import { readBirthInput } from "@myhoodora/api-contract/age";
import { ApiError } from "@myhoodora/api-contract/errors";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { clearAgeAnswer, pendingAgeAnswer } from "@/core/age/age-lock";
import { useAuth } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { openWeb } from "@/shared/utils/open-web";
import { AUTH_PHOTOS, AuthShell } from "../auth/auth-shell";
import { BirthFields, EMPTY_BIRTH, type BirthInput } from "./birth-fields";

/**
 * The age check (docs/compliance/ndpa.md §1), before onboarding, however they signed up. Email
 * sign-ups answered it in the form already, so their answer is sent at once and this is only a
 * moment's spinner; Google sign-ups (and accounts from before the check) answer it here. Under 18,
 * AuthProvider signs out and the sign-up screens say why (CantJoinYet).
 */
export function AgeCheckScreen() {
  const t = useTheme();
  const { user, confirmAge, logout } = useAuth();
  const [value, setValue] = useState<BirthInput>(EMPTY_BIRTH);
  const [problem, setProblem] = useState<string | null>(null);
  // Answered in the email sign-up form: sent on arrival, behind a spinner.
  const [earlier] = useState(pendingAgeAnswer);
  const [sendingEarlier, setSendingEarlier] = useState(earlier !== null);
  const [busy, setBusy] = useState(earlier !== null);
  const started = useRef(false);

  /** Sends the answer; the caller has set `busy`. Old enough: the profile moves the phone on to onboarding. */
  const send = (answer: string) =>
    confirmAge(answer).then(
      (adult) => {
        // Under 18 this screen goes away as the phone signs out.
        if (adult) return;
        setBusy(false);
        setSendingEarlier(false);
      },
      (err: unknown) => {
        setProblem(err instanceof ApiError ? err.message : "We couldn't check that. Please try again.");
        setBusy(false);
        setSendingEarlier(false);
      },
    );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (earlier) {
      clearAgeAnswer();
      void send(earlier);
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    if (busy) return;
    const read = readBirthInput(value);
    if (!read.ok) {
      setProblem(read.problem);
      return;
    }
    setProblem(null);
    setBusy(true);
    void send(read.value);
  };

  if (sendingEarlier) {
    return (
      <AuthShell photo={AUTH_PHOTOS.register} title="Setting up your account" subtitle="">
        <ActivityIndicator color={t.colors.primary} style={styles.spinner} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      photo={AUTH_PHOTOS.register}
      title="When were you born?"
      subtitle="We ask everyone once before they join. Only the result is kept."
    >
      <BirthFields
        value={value}
        onChange={(next) => {
          setValue(next);
          setProblem(null);
        }}
        problem={problem}
        onSubmitEditing={submit}
      />
      <Button label="Continue" onPress={submit} loading={busy} />
      <Text variant="caption" tone="muted" style={styles.center}>
        Why we ask:{" "}
        <Text variant="caption" tone="primary" onPress={() => void openWeb("/privacy#children")} accessibilityRole="link">
          Privacy Policy
        </Text>
      </Text>
      <Text variant="caption" tone="muted" style={styles.center}>
        Signed in as {user?.email}.{" "}
        <Text variant="caption" tone="primary" onPress={() => void logout()} accessibilityRole="button">
          Not you? Sign out
        </Text>
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  spinner: { paddingVertical: 24 },
});
