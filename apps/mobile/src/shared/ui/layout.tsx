import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/shared/theme/theme";
import { FormScrollView } from "./form-scroll-view";

/** A form-style screen: safe areas, scrolls, and keeps the focused field above the keyboard. */
export function Screen({ children, canvas = false }: { children: ReactNode; canvas?: boolean }) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: canvas ? t.colors.canvas : t.colors.background }]} edges={["top", "bottom"]}>
      <FormScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {children}
      </FormScrollView>
    </SafeAreaView>
  );
}

/** The web's card: rounded-2xl, 1 px border, on the canvas. */
export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border, borderRadius: t.radius["2xl"] }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16, flexGrow: 1 },
  card: { borderWidth: 1, padding: 16, gap: 8 },
});
