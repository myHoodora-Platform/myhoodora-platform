import { LEGAL_TITLES, currentLegalVersion, legalVersionLabel, unseenLegalChanges, type LegalDocument } from "@myhoodora/api-contract/legal";
import { errorMessage } from "@myhoodora/api-contract/errors";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/core/auth/auth-provider";
import { clearLegalAcceptance, legalAcceptancePending } from "@/core/legal/pending-acceptance";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { openWeb } from "@/shared/utils/open-web";
import { AUTH_PHOTOS, AuthShell } from "../auth/auth-shell";
import { PolicyReviewModal } from "../legal/policy-review-modal";

const DOCS: { doc: LegalDocument; path: string }[] = [
  { doc: "terms", path: "/terms" },
  { doc: "privacy", path: "/privacy" },
];

/**
 * The "needsTerms" phase (docs/compliance/legal-versions.md), as on the web's /accept-terms: agree to
 * the current Terms of Use and Privacy Policy. Asked once of a new account that hasn't (a Google
 * sign-up), and again after a material change, with what changed. Email sign-ups agreed on the form
 * already (through PolicyReviewModal), so theirs is sent at once behind a spinner; everyone else agrees
 * there too: both documents, each read to the end.
 */
export function AcceptTermsScreen() {
  const t = useTheme();
  const { profile, acceptLegal, logout } = useAuth();
  const toast = useToast();
  const [fromSignUp] = useState(legalAcceptancePending);
  const [busy, setBusy] = useState(fromSignUp);
  const [reviewing, setReviewing] = useState(false);
  const started = useRef(false);
  const versions = { terms: currentLegalVersion("terms").version, privacy: currentLegalVersion("privacy").version };

  /** The caller has set `busy`. Agreed: the profile moves the phone on. */
  const send = (via: "signup" | "prompt") =>
    acceptLegal(versions, via).then(
      () => undefined,
      (err: unknown) => {
        toast(errorMessage(err), "error");
        setBusy(false);
      },
    );

  useEffect(() => {
    if (started.current || !fromSignUp) return;
    started.current = true;
    clearLegalAcceptance();
    void send("signup");
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const legal = profile?.legal;
  if (fromSignUp && busy) {
    return (
      <AuthShell photo={AUTH_PHOTOS.register} title="Setting up your account" subtitle="">
        <ActivityIndicator color={t.colors.primary} style={styles.spinner} />
      </AuthShell>
    );
  }
  const firstTime = !legal?.terms && !legal?.privacy;

  return (
    <AuthShell
      photo={AUTH_PHOTOS.register}
      title={firstTime ? "Before you join" : "We've updated our terms"}
      subtitle={firstTime ? "Please read and agree to how myHoodora works and how we use your data." : "Please read what's changed. You'll need to agree to keep using myHoodora."}
    >
      {DOCS.map(({ doc, path }) => {
        const changes = firstTime ? [] : unseenLegalChanges(doc, legal?.[doc] ?? null).flatMap((v) => v.changes);
        return (
          <View key={doc} style={[styles.card, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
            <View style={styles.cardHead}>
              <Text variant="label">{LEGAL_TITLES[doc]}</Text>
              <Text variant="caption" tone="muted">
                {legalVersionLabel(versions[doc])}
              </Text>
            </View>
            {changes.map((c) => (
              <Text key={c} variant="caption" tone="muted">
                • {c}
              </Text>
            ))}
            <Text variant="caption" tone="primary" onPress={() => void openWeb(path)} accessibilityRole="link">
              Read the {LEGAL_TITLES[doc]}
            </Text>
          </View>
        );
      })}
      <Button label="Read and agree" onPress={() => setReviewing(true)} />
      <PolicyReviewModal
        visible={reviewing}
        onClose={() => setReviewing(false)}
        busy={busy}
        onAgree={() => {
          setBusy(true);
          void send("prompt");
        }}
      />
      <Text variant="caption" tone="muted" style={styles.center}>
        Don&apos;t agree?{" "}
        <Text variant="caption" tone="primary" onPress={() => void logout()} accessibilityRole="button">
          Sign out
        </Text>
        , or delete your account in Settings.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  center: { textAlign: "center" },
  spinner: { paddingVertical: 24 },
});
