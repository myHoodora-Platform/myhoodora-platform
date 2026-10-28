import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, useFonts } from "@expo-google-fonts/outfit";
import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createQueryClient, wireQueryEnvironment } from "@/core/api/query-client";
import { AuthProvider, useAuth } from "@/core/auth/auth-provider";
import { configResult } from "@/core/config/env";
import { initMonitoring, monitoringActive } from "@/core/monitoring/monitoring";
import { AppearanceProvider } from "@/core/preferences/appearance";
import { usePushNotifications } from "@/core/push/use-push-notifications";
import { useTheme } from "@/shared/theme/theme";
import { CrashScreen } from "@/shared/ui/crash-screen";
import { Text } from "@/shared/ui/text";
import { ToastProvider } from "@/shared/ui/toast";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

// First, so a crash anywhere after this is reported (only in preview and production with a DSN).
if (configResult.ok) initMonitoring(configResult.config);

void SplashScreen.preventAutoHideAsync();

/**
 * Which screens exist depends on the session (ADR-003). The splash screen stays up until Firebase and
 * the profile have answered, so a signed-out person never sees the feed flash, nor a signed-in one the login.
 */
function RootNavigator() {
  const { phase } = useAuth();
  const t = useTheme();
  usePushNotifications();
  const settled = phase !== "bootstrapping" && phase !== "profileLoading";

  useEffect(() => {
    if (settled) void SplashScreen.hideAsync();
  }, [settled]);

  return (
    <>
      <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.background } }}>
        <Stack.Screen name="index" />
        {/* The website's public pages, for everyone (terms on the sign-up screen too). */}
        <Stack.Screen name="web" />
        <Stack.Protected guard={phase === "intro"}>
          <Stack.Screen name="intro" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === "signedOut"}>
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === "profileError"}>
          <Stack.Screen name="session-error" />
        </Stack.Protected>
        {/* Also open to onboarded people who haven't verified yet (the feed's "Finish joining"). */}
        <Stack.Protected guard={phase === "needsOnboarding" || phase === "ready"}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: phase === "ready" }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === "ready"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** A build without its EXPO_PUBLIC_* values: say which, instead of crashing on first use. */
function ConfigProblem({ problems }: { problems: string[] }) {
  useEffect(() => void SplashScreen.hideAsync(), []);
  return (
    <ScrollView contentContainerStyle={styles.problem}>
      <Text variant="title">App configuration is incomplete</Text>
      <Text tone="muted">Set these in apps/mobile/.env.local (see .env.example) or in the EAS environment, then restart:</Text>
      {problems.map((p) => (
        <Text key={p} variant="caption">
          • {p}
        </Text>
      ))}
    </ScrollView>
  );
}

/** A render error anywhere below: the crash screen (reported to Sentry by the boundary), never a white screen. */
function CrashFallback({ resetError }: { resetError: () => void }) {
  useEffect(() => void SplashScreen.hideAsync(), []);
  return <CrashScreen onRestart={resetError} />;
}

function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
      <App />
    </Sentry.ErrorBoundary>
  );
}

// Sentry's wrapper (touch breadcrumbs, app-start timing) only when reporting is on; it warns otherwise.
export default monitoringActive() ? Sentry.wrap(RootLayout) : RootLayout;

function App() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => wireQueryEnvironment(), []);
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold });

  // Fonts that fail to load fall back to the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;
  if (!configResult.ok) return <ConfigProblem problems={configResult.problems} />;

  return (
    <GestureHandlerRootView style={styles.root}>
    {/* Long forms keep the field being typed in above the keyboard (KeyboardAwareScrollView). */}
    <KeyboardProvider>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppearanceProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </AppearanceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  problem: { padding: 24, paddingTop: 80, gap: 12 },
});
