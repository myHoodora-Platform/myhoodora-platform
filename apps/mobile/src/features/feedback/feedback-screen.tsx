import { useQuery } from "@tanstack/react-query";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { ScrollView, StyleSheet, View } from "react-native";
import { getPrompt, markShown } from "./feedback-api";
import { PromptBody } from "./prompt-body";
import { useEffect } from "react";

/** `/feedback/<id>`: a prompt opened from its notification, on its own screen. */
export function FeedbackScreen({ id }: { id: string }) {
  return (
    <AppScreen title="Quick question" fallback="/news-feed" canvas={false}>
      <Content id={id} />
    </AppScreen>
  );
}

function Content({ id }: { id: string }) {
  const user = useSignedInUser();
  const router = useRouter();
  const insets = useScreenInsets();
  const prompt = useQuery({ queryKey: ["prompt", id], queryFn: () => getPrompt(user, id), retry: false });
  useEffect(() => {
    if (prompt.data) void markShown(user, id).catch(() => undefined);
  }, [prompt.data, user, id]);
  if (prompt.isError) return <ErrorState error={prompt.error} title="This question isn't open" onRetry={() => router.back()} />;
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      {prompt.data ? (
        <PromptBody prompt={prompt.data} onDone={() => router.back()} />
      ) : (
        <View style={styles.loading}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={60} radius={16} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ loading: { padding: 20, gap: 12 } });
