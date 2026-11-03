import { useLocalSearchParams } from "expo-router";
import { GroupInfoScreen } from "@/features/chat/group-screens";

export default function GroupInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupInfoScreen id={id} />;
}
