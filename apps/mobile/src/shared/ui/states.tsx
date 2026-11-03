import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import { CloudOff, Hourglass, TriangleAlert } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { tint, useTheme } from "@/shared/theme/theme";
import { Button } from "./button";
import { Text } from "./text";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label} accessible>
      <ActivityIndicator color={t.colors.primary} size="large" />
    </View>
  );
}

/**
 * Any failure, in the shared wording (offline, slow, server…), with a retry when one could help. For a
 * connection problem it also says the screen will fill in by itself once the signal is back, which it
 * does (queries refetch on reconnect), so nobody is left staring at a dead page.
 */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const t = useTheme();
  const kind = error instanceof ApiError ? error.kind : null;
  const canRetry = !(error instanceof ApiError) || error.isRetryable;
  const connection = kind === "offline" || kind === "network";
  const Icon = connection ? CloudOff : kind === "timeout" ? Hourglass : TriangleAlert;
  // A screen's own title ("This post isn't available") would mislead when the network is the cause.
  const heading =
    kind === "offline"
      ? "You're offline"
      : kind === "timeout"
        ? "Slow connection"
        : kind === "network"
          ? "Can't reach myHoodora"
          : kind === "server"
            ? "Something went wrong"
            : (title ?? "That didn't load");
  return (
    <View style={styles.center}>
      <View style={[styles.icon, { backgroundColor: tint(t.colors.mutedForeground, 0.12) }]}>
        <Icon size={26} color={t.colors.mutedForeground} />
      </View>
      <Text variant="heading" style={styles.text}>
        {heading}
      </Text>
      <Text tone="muted" style={styles.text}>
        {kind === "offline" ? "Check your connection. This will load by itself when you're back online." : errorMessage(error)}
      </Text>
      {onRetry && canRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.center}>
      <Text variant="heading" style={styles.text}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={styles.text}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  text: { textAlign: "center" },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
