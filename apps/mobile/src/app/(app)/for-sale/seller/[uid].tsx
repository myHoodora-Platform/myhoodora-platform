import { useLocalSearchParams } from "expo-router";
import { SellerListingsScreen } from "@/features/listings/seller-listings-screen";

export default function SellerListings() {
  const { uid, name } = useLocalSearchParams<{ uid: string; name?: string }>();
  return <SellerListingsScreen uid={uid} name={name} />;
}
