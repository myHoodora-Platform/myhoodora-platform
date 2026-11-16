import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { RefreshCw, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOtaUpdate } from "@/core/updates/ota-update";
import { useStoreUpdate } from "./store-update";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";

const STORE = { android: "Google Play", ios: "the App Store" } as const;
const storeName = () => (Platform.OS === "ios" ? STORE.ios : STORE.android);

/**
 * Everything that asks people to update, above every screen (root layout):
 * - below the admin-set minimum store version: a full screen with only "Update now";
 * - below the latest store version: a sheet they can skip (it comes back in a few days, or for a newer version);
 * - an over-the-air update downloaded: a small "Restart to update" banner.
 */
export function AppUpdatePrompts() {
  const t = useTheme();
  const store = useStoreUpdate();
  const ota = useOtaUpdate();
  const [otaHidden, setOtaHidden] = useState(false);

  if (store.status === "required" && store.rule?.storeUrl) return <UpdateRequired storeUrl={store.rule.storeUrl} />;
  return (
    <>
      <Sheet visible={store.status === "available"} title="A new version of myHoodora" onClose={store.skip}>
        <Text tone="muted" style={styles.sheetText}>
          Version {store.rule?.latest} is in {storeName()}, with fixes and improvements. You have {store.installed}.
        </Text>
        <SheetItem
          label="Update now"
          icon={<RefreshCw size={20} color={t.colors.primary} />}
          onPress={() => {
            store.skip();
            if (store.rule?.storeUrl) void Linking.openURL(store.rule.storeUrl);
          }}
        />
      </Sheet>
      {ota.ready && !otaHidden && store.status !== "available" ? <RestartBanner onRestart={ota.restart} onHide={() => setOtaHidden(true)} /> : null}
    </>
  );
}

/** This version no longer works with the service: nothing but the way to the store. Android back does nothing. */
function UpdateRequired({ storeUrl }: { storeUrl: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("Update required. This version of myHoodora no longer works.");
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.required, { backgroundColor: t.colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      <Image source={require("../../../assets/brand/mascot-house.png")} style={styles.art} contentFit="contain" accessible={false} />
      <Text variant="title" style={styles.centre}>
        Time to update
      </Text>
      <Text tone="muted" style={styles.centre}>
        This version of myHoodora no longer works. Update from {storeName()} to keep up with your neighbours. Your posts, messages and Hood are all safe.
      </Text>
      <Button label="Update now" onPress={() => void Linking.openURL(storeUrl)} accessibilityHint={`Opens ${storeName()}`} style={styles.button} />
    </View>
  );
}

/** An over-the-air update is downloaded: restart now, or it's applied the next time the app opens. */
function RestartBanner({ onRestart, onHide }: { onRestart: () => void; onHide: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => AccessibilityInfo.announceForAccessibility("An update is ready. Restart the app to use it."), []);
  return (
    <View pointerEvents="box-none" style={[styles.bannerWrap, { top: insets.top + 8 }]}>
      <View style={[styles.banner, { backgroundColor: t.colors.card, borderColor: tint(t.colors.primary, 0.35) }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <RefreshCw size={18} color={t.colors.primary} />
        <View style={styles.bannerText}>
          <Text variant="label">An update is ready</Text>
          <Text variant="caption" tone="muted">
            Restart to use it, or it&apos;s applied next time.
          </Text>
        </View>
        <Pressable onPress={onRestart} accessibilityRole="button" accessibilityHint="Reloads the app with the update" hitSlop={8} style={[styles.restart, { backgroundColor: t.colors.primary }]}>
          <Text variant="label" style={{ color: t.colors.primaryForeground }}>
            Restart
          </Text>
        </Pressable>
        <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel="Later" hitSlop={8} style={styles.close}>
          <X size={18} color={t.colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  required: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16, zIndex: 100, elevation: 100 },
  art: { width: 140, height: 96 },
  centre: { textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: 8 },
  sheetText: { paddingHorizontal: 12, paddingBottom: 8 },
  bannerWrap: { position: "absolute", left: 12, right: 12, zIndex: 90, elevation: 90 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerText: { flex: 1 },
  restart: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  close: { width: MIN_TOUCH - 8, height: MIN_TOUCH - 8, alignItems: "center", justifyContent: "center" },
});
