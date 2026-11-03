import { useLocalSearchParams } from "expo-router";
import { ListingScreen } from "@/features/listings/listing-screen";

export default function Listing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingScreen id={id} />;
}
