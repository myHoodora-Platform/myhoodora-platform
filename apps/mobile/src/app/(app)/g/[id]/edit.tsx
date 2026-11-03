import { useLocalSearchParams } from "expo-router";
import { EditGroupScreen } from "@/features/groups/group-form-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditGroupScreen id={id} />;
}
