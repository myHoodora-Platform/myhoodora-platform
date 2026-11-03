import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { Check, EyeOff, Settings2, ShieldCheck, UserPlus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { HoodMapBadge } from "@/shared/ui/hood-map-badge";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";
import { shareLink } from "@/shared/utils/share";
import { feedKeys, getHood } from "./feed-api";

/**
 * Tapping your neighbourhood: switch between home and the neighbourhoods you follow (read only),
 * manage them, and invite neighbours. Your address never shows.
 */
export function HoodSheet({ visible, onClose, viewing, onView }: { visible: boolean; onClose: () => void; viewing: string | null; onView: (id: string | null) => void }) {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const homeId = profile?.neighborhoodId ?? null;
  const home = useQuery({ queryKey: feedKeys.hoodName(homeId ?? ""), queryFn: () => getHood(user, homeId!), enabled: !!homeId, staleTime: Infinity });
  const options = [
    ...(homeId ? [{ id: homeId, name: home.data?.name ?? "Home", city: home.data?.city, home: true }] : []),
    ...(profile?.secondaryHoods ?? []).map((h) => ({ id: h.id, name: h.name, city: h.city, home: false })),
  ];
  const current = viewing ?? homeId;
  return (
    <Sheet visible={visible} title="Your neighbourhoods" onClose={onClose}>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((o) => {
          const on = o.id === current;
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                onView(o.home ? null : o.id);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.option, { backgroundColor: on ? tint(t.colors.primary, 0.08) : pressed ? t.colors.muted : "transparent" }]}
            >
              <HoodMapBadge size={44} />
              <View style={styles.flex}>
                <Text variant="label">{o.name}</Text>
                <Text variant="caption" tone="muted">
                  {[o.city, o.home ? "Home: where you post" : "Following: read and alerts"].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {on ? <Check size={20} color={t.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.facts}>
        {profile?.verificationStatus === "verified" ? (
          <View style={styles.fact}>
            <ShieldCheck size={18} color={t.colors.success} />
            <Text variant="caption" style={styles.flex}>
              You&apos;re a verified neighbour at home.
            </Text>
          </View>
        ) : null}
        <View style={styles.fact}>
          <EyeOff size={18} color={t.colors.mutedForeground} />
          <Text variant="caption" style={styles.flex}>
            Neighbours see your neighbourhood&apos;s name, never your address.
          </Text>
        </View>
      </View>
      <SheetItem
        label="Manage neighbourhoods"
        icon={<Settings2 size={20} color={t.colors.primary} />}
        onPress={() => {
          onClose();
          router.push("/settings/neighbourhoods");
        }}
      />
      <SheetItem
        label="Invite neighbours"
        icon={<UserPlus size={20} color={t.colors.primary} />}
        onPress={() => {
          onClose();
          void shareLink("/", `Join me on myHoodora, the app for neighbours in ${home.data?.name ?? "our neighbourhood"}.`);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  options: { gap: 4, paddingVertical: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, minHeight: MIN_TOUCH + 12 },
  facts: { gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  fact: { flexDirection: "row", alignItems: "center", gap: 10 },
});
