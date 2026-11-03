import { useLocalSearchParams } from "expo-router";
import { AlertsScreen } from "@/features/alerts/alerts-screen";

/** `/alerts`, or `/alerts?type=power` for one kind (the web's links). */
export default function Alerts() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return <AlertsScreen type={type} />;
}
