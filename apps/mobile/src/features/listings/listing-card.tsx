import type { Listing } from "@myhoodora/api-contract/types";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Package } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { tint, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { formatNaira } from "@/shared/utils/format";
import { timeAgo } from "@/shared/utils/time";
import { statusLabel } from "./listings-api";

/** A tile in the For Sale grid: photo, price, title. Sold or pending says so on the photo. */
export const ListingCard = memo(function ListingCard({ listing }: { listing: Listing }) {
  const t = useTheme();
  const router = useRouter();
  const free = listing.priceNaira === null;
  const photo = listing.photos[0];
  return (
    <Pressable
      onPress={() => router.push(`/for-sale/${listing._id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${listing.title}, ${formatNaira(listing.priceNaira)}${listing.status !== "available" ? `, ${statusLabel(listing.status, free)}` : ""}`}
      style={({ pressed }) => [styles.card, { backgroundColor: t.colors.card, opacity: pressed ? 0.9 : 1 }, t.scheme === "light" && styles.shadow]}
    >
      <View style={[styles.photo, { backgroundColor: t.colors.muted }]}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={listing._id} accessible={false} /> : <Package size={32} color={t.colors.mutedForeground} />}
        {listing.status !== "available" ? (
          <View style={[styles.status, { backgroundColor: listing.status === "pending" ? t.colors.warning : "rgba(0,0,0,0.7)" }]}>
            <Text variant="caption" style={styles.statusText}>
              {statusLabel(listing.status, free)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="label" style={[styles.price, free && { color: t.colors.primary }]}>
          {formatNaira(listing.priceNaira)}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {timeAgo(listing.createdAt)}
        </Text>
      </View>
      {free ? (
        <View style={[styles.free, { backgroundColor: tint(t.colors.primary, 0.9) }]}>
          <Text variant="caption" style={styles.statusText}>
            Free
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: "hidden" },
  shadow: { shadowColor: "#0b1716", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  photo: { aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  status: { position: "absolute", left: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  free: { position: "absolute", left: 8, top: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: "#ffffff", fontSize: 12 },
  body: { padding: 12, gap: 2 },
  price: { fontSize: 16 },
  title: { fontSize: 15, lineHeight: 20 },
});
