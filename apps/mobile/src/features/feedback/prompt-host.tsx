import type { Prompt } from "@myhoodora/api-contract/prompts";
import { X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useTheme } from "@/shared/theme/theme";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { signal } from "./engagement";
import { markDismissed, markShown } from "./feedback-api";
import { PromptBody } from "./prompt-body";
import { promptStore, useCurrentPrompt } from "./prompt-store";

/**
 * Shows the waiting feedback prompt as a sheet or a centred card (feed-card prompts are the feed's).
 * Also tells the API each time the app opens, which is when "on app open" and sent prompts appear.
 * Mounted once, for everything signed in.
 */
export function PromptHost() {
  const user = useSignedInUser();
  const prompt = useCurrentPrompt();

  // On launch, and each time the app comes back after a while.
  useEffect(() => {
    signal(user, "app_open");
    let backgroundedAt = 0;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") backgroundedAt = Date.now();
      if (s === "active" && backgroundedAt && Date.now() - backgroundedAt > 30 * 60_000) signal(user, "app_open");
    });
    return () => sub.remove();
  }, [user]);

  if (!prompt || prompt.layout === "feed") return null;
  return <PromptOverlay key={prompt._id} prompt={prompt} />;
}

/** Counts it as shown once on screen; closing without answering counts as dismissed. */
export function usePromptLifecycle(prompt: Prompt) {
  const user = useSignedInUser();
  const answered = useRef(false);
  useEffect(() => {
    void markShown(user, prompt._id).catch(() => undefined);
  }, [user, prompt._id]);
  return {
    close: () => {
      if (!answered.current) void markDismissed(user, prompt._id).catch(() => undefined);
      promptStore.clear(prompt._id);
    },
    done: () => {
      answered.current = true;
      promptStore.clear(prompt._id);
    },
    markAnswered: () => {
      answered.current = true;
    },
  };
}

function PromptOverlay({ prompt }: { prompt: Prompt }) {
  const t = useTheme();
  const life = usePromptLifecycle(prompt);
  const [height, setHeight] = useState<number | undefined>(undefined);
  if (prompt.layout === "sheet") {
    return (
      <Modal visible transparent animationType="none" onRequestClose={life.close} statusBarTranslucent>
        <GestureHandlerRootView style={styles.flex}>
          <BottomSheet label="Feedback" onClose={life.close} header={(close) => <CloseRow onClose={close} />} minOpen={0} contentHeight={height}>
            <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
              <PromptBody prompt={prompt} onDone={life.done} />
            </View>
          </BottomSheet>
        </GestureHandlerRootView>
      </Modal>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={life.close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={life.close} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={ZoomIn.duration(200)} style={[styles.dialog, { backgroundColor: t.colors.background }]} accessibilityViewIsModal>
          <CloseRow onClose={life.close} />
          <PromptBody prompt={prompt} onDone={life.done} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function CloseRow({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn} style={styles.closeRow}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Not now" hitSlop={10} style={styles.close}>
        <X size={20} color={t.colors.mutedForeground} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { width: "100%", maxWidth: 420, borderRadius: 24, overflow: "hidden" },
  closeRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 8, paddingTop: 4 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
