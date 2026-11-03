import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * Shown instead of a blank screen when the app hits an error it can't recover from. Works without any
 * provider above it (the theme falls back to the system's light or dark), since a provider may be what failed.
 */
export function CrashScreen({ onRestart }: { onRestart: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]} accessibilityRole="alert">
      <Image source={require("../../../assets/brand/mascot-house.png")} style={styles.art} contentFit="contain" accessible={false} />
      <Text variant="title" style={styles.centre}>
        Something went wrong
      </Text>
      <Text tone="muted" style={styles.centre}>
        The app hit a problem and had to stop. Your posts and messages are safe. Restart to carry on; we&apos;ve been told about it.
      </Text>
      <Button label="Restart" onPress={onRestart} accessibilityHint="Reloads the app" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  art: { width: 120, height: 80 },
  centre: { textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: 8 },
});
