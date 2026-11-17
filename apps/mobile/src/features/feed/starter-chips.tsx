import type { ConversationStarter } from "@myhoodora/api-contract/hood-content";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleHeart } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { Chip } from "@/shared/ui/chip";
import { Text } from "@/shared/ui/text";
import { getStarters } from "./feed-api";

const LABEL: Record<string, string> = { S01: "Introduce yourself" };

/** A starter's chip label: its own name, or its first sentence, short. */
export function chipLabel(s: ConversationStarter): string {
  if (LABEL[s.code]) return LABEL[s.code]!;
  const plain = s.text.replace(/^[^\p{L}\p{N}]+/u, "");
  const first = plain.split(/(?<=[?.!])\s/)[0] ?? plain;
  return first.length > 42 ? `${first.slice(0, 40).trimEnd()}…` : first;
}

/**
 * "Not sure what to say?": conversation starters from the Hood Team's content bank. Tapping one opens
 * the composer with its text in, for the neighbour to make their own (same as the web).
 */
export function StarterChips({ hoodId }: { hoodId: string }) {
  const t = useTheme();
  const user = useSignedInUser();
  const router = useRouter();
  const starters = useQuery({ queryKey: ["starters", hoodId], queryFn: () => getStarters(user), staleTime: 60 * 60 * 1000, retry: false });
  if (!starters.data?.length) return null;
  return (
    <View style={styles.wrap} accessibilityLabel="Conversation starters">
      <View style={styles.title}>
        <MessageCircleHeart size={16} color={t.colors.primary} />
        <Text variant="label" tone="muted">
          Not sure what to say? Start with one of these
        </Text>
      </View>
      <View style={styles.chips}>
        {starters.data.map((s) => (
          <Chip key={s.code} label={chipLabel(s)} onPress={() => router.push({ pathname: "/compose", params: { kind: s.category, text: s.text } })} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  title: { flexDirection: "row", alignItems: "center", gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
