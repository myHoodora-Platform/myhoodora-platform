import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";

/** The sign-in pages' photos: the web's own (scripts/make-assets.cjs). */
export const AUTH_PHOTOS = {
  login: require("../../../assets/photos/login.webp") as ImageSourcePropType,
  register: require("../../../assets/photos/register.webp") as ImageSourcePropType,
  reset: require("../../../assets/photos/reset.webp") as ImageSourcePropType,
};

/**
 * A photo across the top with a back button, and the form on a rounded sheet over it. Scrolls, and keeps
 * the focused field above the keyboard.
 */
export function AuthShell({ photo, title, subtitle, children }: { photo: ImageSourcePropType; title: string; subtitle: string; children: ReactNode }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const photoHeight = Math.round(height * 0.3);

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.grow} keyboardShouldPersistTaps="handled" bounces={false}>
          <Image source={photo} style={{ height: photoHeight }} contentFit="cover" accessible={false} />
          <View style={[styles.sheet, { backgroundColor: t.colors.background, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.heading}>
              <Text variant="title">{title}</Text>
              <Text tone="muted">{subtitle}</Text>
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.back, { top: insets.top + 8, backgroundColor: t.colors.card }]}
        >
          <ChevronLeft size={24} color={t.colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  sheet: { flex: 1, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 28, gap: 18 },
  heading: { gap: 6 },
  back: { position: "absolute", left: 16, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
