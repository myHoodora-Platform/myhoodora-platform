import { useLocalSearchParams } from "expo-router";
import { GroupManageScreen } from "@/features/groups/group-manage-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupManageScreen id={id} />;
}
