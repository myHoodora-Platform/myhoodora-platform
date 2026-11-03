import { useLocalSearchParams } from "expo-router";
import { ComposeScreen } from "@/features/compose/compose-screen";

/** `/compose`, or `/compose?kind=event` to start on a kind of post. */
export default function Compose() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <ComposeScreen kind={kind} />;
}
