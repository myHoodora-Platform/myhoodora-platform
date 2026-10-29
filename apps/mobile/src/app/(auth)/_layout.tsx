import { Stack } from "expo-router";
import { useTheme } from "@/shared/theme/theme";

/** Welcome is the way in; register, login and reset open on top of it, so Back returns there. */
export const unstable_settings = { initialRouteName: "welcome" };

export default function AuthLayout() {
  const t = useTheme();
  // Each screen draws its own back button over its photo.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.background } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
