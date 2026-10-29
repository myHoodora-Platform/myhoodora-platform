import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/shared/ui/text";

/** "New to myHoodora? Join now": a quiet question with one bold action, at the foot of a form. */
export function FooterLink({ question, action, href, replace = false }: { question: string; action: string; href: Href; replace?: boolean }) {
  return (
    <Link href={href} replace={replace} asChild>
      <Pressable accessibilityRole="link" style={styles.row} hitSlop={8}>
        <Text tone="muted">
          {question}{" "}
          <Text variant="label" tone="primary" style={styles.action}>
            {action}
          </Text>
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: "center", paddingVertical: 8 },
  action: { fontSize: 16 },
});
