import { useLocalSearchParams } from "expo-router";
import { GroupInviteScreen } from "@/features/groups/group-invite-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupInviteScreen id={id} />;
}
