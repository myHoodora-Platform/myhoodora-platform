import { HELP_FAQS } from "@myhoodora/api-contract/support";
import { BookOpen, ChevronDown, LifeBuoy, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Text } from "@/shared/ui/text";
import { openWeb } from "@/shared/utils/open-web";

/**
 * `/help`: the web's Help centre, in the app. The same questions as the web (they live in
 * @myhoodora/api-contract/support), and a direct line to the team instead of the web's form.
 */
export function HelpScreen() {
  return (
    <AppScreen title="Help centre" fallback="/menu">
      <Help />
    </AppScreen>
  );
}

function Help() {
  const t = useTheme();
  const insets = useScreenInsets();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <SettingsGroup>
        <SettingsRow Icon={BookOpen} label="Community guidelines" onPress={() => void openWeb("/guidelines", "Community guidelines")} />
        <SettingsRow Icon={ShieldCheck} label="Privacy policy" onPress={() => void openWeb("/privacy", "Privacy policy")} />
      </SettingsGroup>

      <SettingsGroup title="Frequently asked questions">
        {HELP_FAQS.map((f, i) => {
          const expanded = open === f.q;
          return (
            <View key={f.q} style={i ? [styles.divider, { borderTopColor: t.colors.border }] : undefined}>
              <Pressable
                onPress={() => setOpen(expanded ? null : f.q)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={({ pressed }) => [styles.question, { backgroundColor: pressed ? t.colors.muted : "transparent" }]}
              >
                <Text variant="label" style={styles.flex}>
                  {f.q}
                </Text>
                <ChevronDown size={18} color={t.colors.mutedForeground} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
              </Pressable>
              {expanded ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.answer}>
                  <Text tone="muted">{f.a}</Text>
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </SettingsGroup>

      <View style={[styles.contact, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <LifeBuoy size={22} color={t.colors.primary} />
        <Text variant="heading">Still need help?</Text>
        <Text tone="muted" style={styles.centred}>
          Message the myHoodora team. We usually reply within a day.
        </Text>
        <Button label="Message our team" onPress={() => router.push("/inbox/support")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 16, gap: 20 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  question: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: MIN_TOUCH },
  answer: { paddingHorizontal: 16, paddingBottom: 14 },
  contact: { alignItems: "center", gap: 8, padding: 20, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  centred: { textAlign: "center" },
});
