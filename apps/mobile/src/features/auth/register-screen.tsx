import { readBirthInput } from "@myhoodora/api-contract/age";
import { registerSchema } from "@myhoodora/api-contract/auth-validation";
import { useEffect, useRef, useState } from "react";
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
import { ageCheckLocked, lockAgeCheck, rememberAgeAnswer } from "@/core/age/age-lock";
import { rememberLegalAcceptance } from "@/core/legal/pending-acceptance";
import { BirthFields, EMPTY_BIRTH, type BirthInput } from "@/features/age/birth-fields";
import { CantJoinYet } from "@/features/age/cant-join";
import { PolicyReviewModal } from "@/features/legal/policy-review-modal";

type Errors = { email?: string; password?: string; confirm?: string; birth?: string; agreeToTerms?: string };

export function RegisterScreen() {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // The age check, in the form (docs/compliance/ndpa.md §1): Google sign-ups get it on its own screen.
  const [birth, setBirth] = useState<BirthInput>(EMPTY_BIRTH);
  const [agreeToTerms, setAgree] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const inFlight = useRef(false);
  const confirmRef = useRef<TextInput>(null);
  // Turned away by the age check on this phone recently: no new account from here for a while.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    void ageCheckLocked().then(setLocked);
  }, []);

  const submit = async () => {
    // One account request at a time: a second tap before the first re-render would ask Firebase twice
    // (and a duplicate sign-up comes back as "email already in use" after the first succeeded).
    if (inFlight.current) return;
    // The web's rules, plus the retype check this form adds (a phone keyboard makes typos easy).
    const problems: Errors = { ...fieldErrors(registerSchema, { email: email.trim(), password, agreeToTerms }) };
    if (!problems.password && confirm !== password) problems.confirm = "Passwords don't match.";
    const age = readBirthInput(birth);
    if (!age.ok) problems.birth = age.problem;
    const failed = Object.keys(problems).length > 0;
    setErrors(failed ? problems : null);
    setFailure(null);
    if (failed || !age.ok) return;
    // Under 18: no account is made at all, so there's nothing of a child's to delete.
    if (!age.adult) {
      await lockAgeCheck();
      setLocked(true);
      return;
    }
    // Sent by the age check screen as soon as the account exists (the server has the final say).
    rememberAgeAnswer(age.value);
    // They ticked "I agree": recorded as a sign-up agreement once the account exists.
    rememberLegalAcceptance();
    setBusy(true);
    inFlight.current = true;
    try {
      // A new account goes to the age check (which sends the answer above), then onboarding.
      await signUp(email, password);
    } catch (err) {
      setFailure(signInFailure(err));
      setBusy(false);
      inFlight.current = false;
    }
  };

  if (locked) {
    return (
      <AuthShell photo={AUTH_PHOTOS.register} title="Join your neighbourhood" subtitle="">
        <CantJoinYet />
      </AuthShell>
    );
  }

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
        returnKeyType="next"
        error={errors?.confirm}
      />
      <BirthFields
        value={birth}
        onChange={(next) => {
          setBirth(next);
          setErrors((e) => (e ? { ...e, birth: undefined } : e));
        }}
        problem={errors?.birth}
        onSubmitEditing={() => void submit()}
      />
      <View style={styles.row}>
        {/* Turned on only by "I agree" after reading both to the end (PolicyReviewModal); off is direct. */}
        <Switch
          value={agreeToTerms}
          onValueChange={(on) => (on ? setReviewing(true) : setAgree(false))}
          accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
          trackColor={{ true: t.colors.primary, false: t.colors.input }}
        />
        <Text variant="caption" style={styles.flex}>
          I agree to the{" "}
          <Text variant="caption" tone="primary" onPress={() => setReviewing(true)} accessibilityRole="link">
            Terms of Use
          </Text>{" "}
          and{" "}
          <Text variant="caption" tone="primary" onPress={() => setReviewing(true)} accessibilityRole="link">
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      <PolicyReviewModal
        visible={reviewing}
        onClose={() => setReviewing(false)}
        onAgree={() => {
          setAgree(true);
          setErrors((e) => (e ? { ...e, agreeToTerms: undefined } : e));
          setReviewing(false);
        }}
      />
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
