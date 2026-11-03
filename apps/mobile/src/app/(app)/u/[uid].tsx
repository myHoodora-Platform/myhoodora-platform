import { useLocalSearchParams } from "expo-router";
import { NeighbourScreen } from "@/features/profile/neighbour-screen";

export default function Neighbour() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <NeighbourScreen uid={uid} />;
}
