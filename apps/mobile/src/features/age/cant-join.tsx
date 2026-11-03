import { CircleSlash } from "lucide-react-native";
import { Linking, StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";

/** Shown once someone has said they're under 18, and on this phone for a while after (age-lock.ts). */
export function CantJoinYet() {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={[styles.icon, { backgroundColor: t.colors.muted }]}>
        <CircleSlash size={26} color={t.colors.mutedForeground} />
      </View>
      <Text variant="heading" style={styles.center}>
        Sorry, you can&apos;t join myHoodora yet
      </Text>
      <Text tone="muted" style={styles.center}>
        myHoodora is for adults, so we can&apos;t give you an account. We haven&apos;t kept your date of birth, and anything you&apos;d already given us is being deleted.
      </Text>
      <Text tone="muted" style={styles.center}>
        Think there&apos;s been a mistake? Email{" "}
        <Text tone="primary" onPress={() => void Linking.openURL("mailto:privacy@myhoodora.com")} accessibilityRole="link">
          privacy@myhoodora.com
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12, paddingVertical: 8 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
});
