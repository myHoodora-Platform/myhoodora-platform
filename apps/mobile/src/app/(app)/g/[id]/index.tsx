import { useLocalSearchParams } from "expo-router";
import { GroupScreen } from "@/features/groups/group-screen";

/** `/g/<id>`, or `/g/<id>?invite=<token>` from an invite link or notification. */
export default function Group() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  return <GroupScreen id={id} invite={invite} />;
}
