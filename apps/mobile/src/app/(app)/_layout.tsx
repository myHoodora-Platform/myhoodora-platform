import { Stack } from "expo-router";
import { useLiveUpdates } from "@/features/live/use-live-updates";
import { useTheme } from "@/shared/theme/theme";

/** Everything signed in: the tabs, and the screens opened from them (with a back button). */
export default function AppLayout() {
  const t = useTheme();
  // One live connection for everything signed in (contract §19).
  useLiveUpdates();
  return (
    <Stack
      // Every screen draws its own header (AppScreen), so they all look and behave the same.
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.canvas } }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="compose" options={{ presentation: "modal" }} />
      <Stack.Screen name="sell" options={{ presentation: "modal" }} />
      {/* Comments slide up over the screen that opened them; the sheet draws itself (shared/ui/bottom-sheet). */}
      <Stack.Screen name="p/[id]/comments" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
    </Stack>
  );
}
