import { useLocalSearchParams } from "expo-router";
import { SupportThreadScreen } from "@/features/support/support-screens";

export default function SupportThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SupportThreadScreen id={id} />;
}
