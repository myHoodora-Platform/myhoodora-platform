import { X } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { PromptBody } from "./prompt-body";
import { usePromptLifecycle } from "./prompt-host";
import { useCurrentPrompt } from "./prompt-store";
import type { Prompt } from "@myhoodora/api-contract/prompts";

/** A feed-layout prompt: a card at the top of the feed until answered or closed. */
export function FeedPromptCard() {
  const prompt = useCurrentPrompt();
  if (!prompt || prompt.layout !== "feed") return null;
  return <Card key={prompt._id} prompt={prompt} />;
}

function Card({ prompt }: { prompt: Prompt }) {
  const t = useTheme();
  const life = usePromptLifecycle(prompt);
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Pressable onPress={life.close} accessibilityRole="button" accessibilityLabel="Not now" hitSlop={10} style={styles.close}>
        <X size={18} color={t.colors.mutedForeground} />
      </Pressable>
      <PromptBody prompt={prompt} onDone={life.done} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  close: { position: "absolute", right: 8, top: 8, zIndex: 1, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
