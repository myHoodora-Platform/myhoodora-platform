import { type Href } from "expo-router";
import { useRouter } from "@/core/navigation/use-router";
import { ChevronLeft } from "lucide-react-native";
import { createContext, useContext, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/shared/theme/theme";
import { FixedHeader, useHeaderEstimate } from "./fixed-header";
import { IconButton } from "./icon-button";
import { Text } from "./text";

/** How far a screen's content must clear: under the fixed header, and above the footer or home bar. */
interface ScreenInsets {
  top: number;
  bottom: number;
}

const ScreenInsetsContext = createContext<ScreenInsets>({ top: 0, bottom: 0 });

/** For the scrolling content inside an AppScreen: pad by these so nothing hides under the chrome. */
export function useScreenInsets(): ScreenInsets {
  return useContext(ScreenInsetsContext);
}

/**
 * The header bar every pushed screen shares: back on the left, a title (or anything, such as the
 * post's author) in the middle, actions on the right.
 */
export function HeaderBar({ title, center, right, back = true, fallback }: { title?: string; center?: ReactNode; right?: ReactNode; back?: boolean; fallback?: Href }) {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallback ?? "/news-feed"));
  return (
    <View style={styles.bar}>
      {back ? <IconButton Icon={ChevronLeft} label="Back" onPress={goBack} /> : <View style={styles.side} />}
      {/* A title centres, as iOS titles do; custom content (an author, a person) reads from the left. */}
      <View style={[styles.center, center ? styles.start : null]}>
        {center ??
          (title ? (
            <Text variant="heading" numberOfLines={1} accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null)}
      </View>
      <View style={styles.right}>{right ?? <View style={styles.side} />}</View>
    </View>
  );
}

/**
 * One layout for every screen pushed over the tabs: a fixed header (glass or plain, per Appearance)
 * that content scrolls under, and an optional footer (a reply box, a send bar) that rides above the
 * keyboard. The content reads its padding from `useScreenInsets()`.
 */
export function AppScreen({
  children,
  footer,
  canvas = true,
  ...header
}: {
  children: ReactNode;
  footer?: ReactNode;
  canvas?: boolean;
  title?: string;
  center?: ReactNode;
  right?: ReactNode;
  back?: boolean;
  fallback?: Href;
}) {
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const [top, setTop] = useState(useHeaderEstimate(52));
  const [footerHeight, setFooterHeight] = useState(0);
  const bottom = footer ? footerHeight : safe.bottom;
  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: canvas ? t.colors.canvas : t.colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenInsetsContext.Provider value={{ top, bottom }}>
        <View style={styles.flex}>{children}</View>
      </ScreenInsetsContext.Provider>
      {footer ? <View onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}>{footer}</View> : null}
      <FixedHeader onHeight={setTop} compact>
        <HeaderBar {...header} />
      </FixedHeader>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  side: { width: 44 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  start: { alignItems: "flex-start" },
  title: { textAlign: "center" },
  right: { minWidth: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 2 },
});
