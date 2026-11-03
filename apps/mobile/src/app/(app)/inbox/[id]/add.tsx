import { useLocalSearchParams } from "expo-router";
import { AddPeopleScreen } from "@/features/chat/group-screens";

export default function AddPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddPeopleScreen id={id} />;
}
