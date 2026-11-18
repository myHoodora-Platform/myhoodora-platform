import { useLocalSearchParams } from "expo-router";
import { ComposeScreen } from "@/features/compose/compose-screen";

/** `/compose`, `/compose?kind=event` to start on a kind of post, `&text=…` to start from a conversation starter. */
export default function Compose() {
  const { kind, text } = useLocalSearchParams<{ kind?: string; text?: string }>();
  return <ComposeScreen kind={kind} text={text} />;
}
