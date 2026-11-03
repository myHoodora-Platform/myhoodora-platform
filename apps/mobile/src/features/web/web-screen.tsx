import { useFocusEffect } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { BackHandler, Linking, StyleSheet, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { config } from "@/core/config/env";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { IconButton } from "@/shared/ui/icon-button";
import { ErrorState } from "@/shared/ui/states";
import { webPageUrl, isSameSite, pageTitle } from "./web-urls";

/**
 * Marks the page as shown inside the app before it draws, so the site hides its own header and
 * footer (apps/web/src/app/globals.css: html[data-in-app]). The app's header takes their place.
 */
const IN_APP = "document.documentElement.setAttribute('data-in-app', ''); true;";

/**
 * `/web?path=/guidelines`: one of the website's public pages inside the app, under the app's own
 * header, so reading the guidelines or the Business page never leaves myHoodora. Links to other
 * sites open in the phone's browser; Android's back goes back a page first.
 */
export function WebScreen({ path, title }: { path?: string; title?: string }) {
  const [page, setPage] = useState({ title: title ?? "", url: webPageUrl(config().webUrl, path) });
  return (
    <AppScreen
      title={page.title || "myHoodora"}
      fallback="/"
      canvas={false}
      right={<IconButton Icon={ExternalLink} label="Open in your browser" onPress={() => void Linking.openURL(page.url)} />}
    >
      <Page start={webPageUrl(config().webUrl, path)} onPage={(url, t) => setPage((p) => ({ url, title: title ?? (pageTitle(t) || p.title) }))} />
    </AppScreen>
  );
}

function Page({ start, onPage }: { start: string; onPage: (url: string, title: string) => void }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const web = useRef<WebView>(null);
  const back = useRef(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const site = config().webUrl;

  // Android's back button steps back through the pages read here before leaving the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!back.current) return false;
        web.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const onNavigation = (nav: WebViewNavigation) => {
    back.current = nav.canGoBack;
    onPage(nav.url, nav.title);
  };

  if (failed) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <ErrorState error={new Error("offline")} title="This page didn't load" onRetry={() => setFailed(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top, backgroundColor: t.colors.background }]}>
      <WebView
        ref={web}
        source={{ uri: start }}
        style={[styles.flex, { backgroundColor: t.colors.background }]}
        injectedJavaScriptBeforeContentLoaded={IN_APP}
        // Pages that load later in the same view are marked too.
        injectedJavaScript={IN_APP}
        onNavigationStateChange={onNavigation}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onError={() => setFailed(true)}
        // Our pages stay here; anywhere else (a partner's site, a mail link) opens outside the app.
        onShouldStartLoadWithRequest={(req) => {
          if (isSameSite(req.url, site)) return true;
          void Linking.openURL(req.url).catch(() => undefined);
          return false;
        }}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        // The site's own sign-in isn't used here: these pages are public.
        sharedCookiesEnabled={false}
        contentInset={{ bottom: insets.bottom }}
      />
      {progress < 1 ? <View style={[styles.progress, { top: insets.top, width: `${Math.max(8, progress * 100)}%`, backgroundColor: t.colors.primary }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { position: "absolute", left: 0, height: 3, borderRadius: 2 },
});
