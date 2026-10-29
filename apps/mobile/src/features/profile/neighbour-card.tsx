import type { PublicProfile } from "@myhoodora/api-contract/types";
import { BadgeCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { monthYear } from "@/shared/utils/time";

/**
 * Who someone is, from their public profile only (contract §3): face, name with the verified badge,
 * "Ikeja · Neighbour since October 2026" (when they show it), and their bio. Never an address.
 */
export function NeighbourCard({ profile, size = 88, centred = true }: { profile: Pick<PublicProfile, "displayName" | "photoURL" | "verified" | "neighborhoodName" | "neighbourSince" | "bio" | "kind">; size?: number; centred?: boolean }) {
  const t = useTheme();
  const since = monthYear(profile.neighbourSince);
  const meta = [profile.neighborhoodName, since && `Neighbour since ${since}`].filter(Boolean).join(" · ");
  return (
    <View style={[styles.card, centred && styles.centred]}>
      <Avatar name={profile.displayName} photoURL={profile.photoURL} size={size} />
      <View style={[styles.nameRow, centred && styles.centredRow]}>
        <Text variant="title" style={centred ? styles.centredText : undefined} numberOfLines={2}>
          {profile.displayName}
        </Text>
        {profile.verified ? <BadgeCheck size={22} color={t.colors.primary} accessibilityLabel={profile.kind === "organisation" ? "Verified organisation" : "Verified neighbour"} /> : null}
      </View>
      {meta ? (
        <Text tone="muted" style={centred ? styles.centredText : undefined}>
          {meta}
        </Text>
      ) : null}
      {profile.bio ? <Text style={[styles.bio, centred && styles.centredText]}>{profile.bio}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  centred: { alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  centredRow: { justifyContent: "center" },
  centredText: { textAlign: "center" },
  bio: { fontSize: 15, lineHeight: 22, marginTop: 4 },
});
