import {
  LEGAL_TITLES,
  currentLegalVersion,
  legalVersionLabel,
  type LegalDocument,
} from "@myhoodora/api-contract/legal";
import { ArrowDown, ExternalLink, Lock, X } from "lucide-react-native";
import { useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { config } from "@/core/config/env";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { isSamePage, webPageUrl } from "../web/web-urls";

const STEPS: { doc: LegalDocument; path: string }[] = [
  { doc: "terms", path: "/terms" },
  { doc: "privacy", path: "/privacy" },
];

const READ = "legal-read";

/**
 * Runs in the page: hides the site's own header and footer (as features/web does), then says "read"
 * once the end of the text has been on screen. The web marks that end with [data-legal-end]
 * (components/legal/legal-page.tsx); a site deployed before the marker falls back to the page's
 * bottom, less the cross-links under the text.
 */
const WATCH_END = `
document.documentElement.setAttribute('data-in-app', '');
(function () {
  var sent = false;
  function read() { if (!sent) { sent = true; window.ReactNativeWebView.postMessage('${READ}'); } }
  function watch() {
    var end = document.querySelector('[data-legal-end]');
    if (end && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { if (e.some(function (x) { return x.isIntersecting; })) read(); }).observe(end);
      return;
    }
    window.addEventListener('scroll', function () {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 600) read();
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
true;`;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called once both documents have been read to the end and "I agree" pressed. */
  onAgree: () => void;
  busy?: boolean;
}

/**
 * The Terms of Use, then the Privacy Policy, as the website's own pages in a browser-like sheet.
 * "Next" and "I agree" stay off until each page has been scrolled to the end. Used by sign-up and
 * the "needsTerms" phase; the web's PolicyReviewDialog does the same.
 */
export function PolicyReviewModal({ visible, ...sheet }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => !sheet.busy && sheet.onClose()}
      statusBarTranslucent
    >
      {/* Mounted per opening, so each one starts again from the Terms. */}
      {visible ? <Sheet {...sheet} /> : null}
    </Modal>
  );
}

function Sheet({ onClose, onAgree, busy = false }: Omit<Props, "visible">) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [read, setRead] = useState<Partial<Record<LegalDocument, boolean>>>({});
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const { doc, path } = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const done = Boolean(read[doc]);
  const site = config().webUrl;
  const url = webPageUrl(site, path);

  const onMessage = (e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === READ) setRead((r) => ({ ...r, [doc]: true }));
  };

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: t.colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Browser-style address bar: the page itself, at myhoodora.com. */}
      <View
        style={[
          styles.bar,
          { backgroundColor: t.colors.muted, borderColor: t.colors.border },
        ]}
      >
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={styles.icon}
        >
          <X size={20} color={t.colors.foreground} />
        </Pressable>
        <View style={[styles.address, { backgroundColor: t.colors.card }]}>
          <Lock size={12} color={t.colors.mutedForeground} />
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            style={styles.flex}
          >
            myhoodora.com{path}
          </Text>
        </View>
        <Pressable
          onPress={() => void Linking.openURL(url)}
          accessibilityRole="button"
          accessibilityLabel="Open in your browser"
          hitSlop={12}
          style={styles.icon}
        >
          <ExternalLink size={18} color={t.colors.foreground} />
        </Pressable>
      </View>
      {progress < 1 ? (
        <View
          style={[
            styles.progress,
            {
              width: `${Math.max(8, progress * 100)}%`,
              backgroundColor: t.colors.primary,
            },
          ]}
        />
      ) : null}

      <View style={styles.head}>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View
              key={s.doc}
              style={[
                styles.step,
                {
                  backgroundColor:
                    i < step || (i === step && done)
                      ? t.colors.primary
                      : i === step
                        ? t.colors.ring
                        : t.colors.muted,
                },
              ]}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted">
          {step + 1} of {STEPS.length} · Last updated{" "}
          {legalVersionLabel(currentLegalVersion(doc).version)}
        </Text>
        <Text variant="heading">{LEGAL_TITLES[doc]}</Text>
      </View>

      <View
        style={[styles.flex, { borderColor: t.colors.border }, styles.page]}
      >
        {failed ? (
          <ErrorState
            error={new Error("offline")}
            title="This page didn't load"
            onRetry={() => setFailed(false)}
          />
        ) : (
          <WebView
            key={doc}
            source={{ uri: url }}
            style={[styles.flex, { backgroundColor: t.colors.background }]}
            injectedJavaScriptBeforeContentLoaded="document.documentElement.setAttribute('data-in-app', ''); true;"
            injectedJavaScript={WATCH_END}
            onMessage={onMessage}
            onLoadStart={() => setProgress(0)}
            onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
            onError={() => setFailed(true)}
            // Links inside the text (another policy, a mail address) open outside, so this stays on the page being read.
            onShouldStartLoadWithRequest={(req) => {
              if (isSamePage(req.url, site, path)) return true;
              void Linking.openURL(req.url).catch(() => undefined);
              return false;
            }}
            setSupportMultipleWindows={false}
            sharedCookiesEnabled={false}
          />
        )}
      </View>

      <View
        style={[
          styles.foot,
          { paddingBottom: insets.bottom + 12, borderColor: t.colors.border },
        ]}
      >
        <View style={styles.hint} accessibilityLiveRegion="polite">
          {done ? null : (
            <ArrowDown size={14} color={t.colors.mutedForeground} />
          )}
          <Text variant="caption" tone="muted">
            {done
              ? last
                ? "Thanks for reading both."
                : `Next, the ${LEGAL_TITLES[STEPS[step + 1]!.doc]}.`
              : "Scroll to the end to continue"}
          </Text>
        </View>
        <View style={styles.actions}>
          {step > 0 ? (
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep(step - 1)}
              disabled={busy}
              style={styles.back}
            />
          ) : null}
          <Button
            label={last ? "I agree" : "Next"}
            onPress={() => (last ? onAgree() : setStep(step + 1))}
            disabled={!done}
            loading={busy}
            style={styles.flex}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  address: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progress: { height: 3, borderRadius: 2 },
  head: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4 },
  steps: { flexDirection: "row", gap: 6, marginBottom: 6 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  page: { borderTopWidth: StyleSheet.hairlineWidth },
  foot: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: { flexDirection: "row", gap: 10 },
  back: { minWidth: 96 },
});
