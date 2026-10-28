import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Listing, ListingStatus } from "@myhoodora/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Tag, Trash2 } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { signal } from "@/features/feedback/engagement";
import { deleteListing, listingKeys, setListingStatus } from "./listings-api";

/**
 * Your own listing (Facebook Marketplace's seller view): where it stands (Available, Pending while
 * someone's collecting it, Sold or Given away) in one tap, and deleting it. Neighbours see the change
 * on the listing at once; sold ones leave For Sale.
 */
export function SellerTools({ listing: l }: { listing: Listing }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const free = l.priceNaira === null;

  const status = useMutation({
    mutationFn: (next: ListingStatus) => setListingStatus(user, l._id, next),
    onMutate: (next) => {
      const before = client.getQueryData<Listing>(listingKeys.one(l._id));
      client.setQueryData<Listing>(listingKeys.one(l._id), (x) => (x ? { ...x, status: next } : x));
      return { before };
    },
    onSuccess: (saved, next) => {
      client.setQueryData(listingKeys.one(l._id), { ...l, ...saved });
      void client.invalidateQueries({ queryKey: listingKeys.all });
      // "After their first sale" can ask for a store review or a feedback question.
      if (next === "sold") signal(user, "listing_sold", l._id);
      toast(next === "sold" ? (free ? "Marked as given away. It's left For Sale." : "Marked as sold. It's left For Sale.") : next === "pending" ? "Marked as pending." : "Available again.");
    },
    onError: (err, _next, ctx) => {
      if (ctx?.before) client.setQueryData(listingKeys.one(l._id), ctx.before);
      toast(errorMessage(err), "error");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteListing(user, l._id),
    onSuccess: () => {
      client.removeQueries({ queryKey: listingKeys.one(l._id) });
      void client.invalidateQueries({ queryKey: listingKeys.all });
      toast("Listing deleted.");
      if (router.canGoBack()) router.back();
      else router.replace("/for-sale");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const confirmDelete = () =>
    Alert.alert("Delete this listing?", "It's removed for everyone. Conversations about it stay in Messages.", [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);

  const options: { id: ListingStatus; label: string; hint: string; Icon: typeof Tag }[] = [
    { id: "available", label: "Available", hint: "Neighbours can message you", Icon: Tag },
    { id: "pending", label: "Pending", hint: "Someone's collecting it", Icon: Clock },
    { id: "sold", label: free ? "Given away" : "Sold", hint: "It leaves For Sale", Icon: CheckCircle2 },
  ];

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Text variant="label">Your listing</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Listing status">
        {options.map(({ id, label, Icon }) => {
          const on = l.status === id;
          return (
            <Pressable
              key={id}
              onPress={() => !on && status.mutate(id)}
              disabled={status.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: status.isPending }}
              accessibilityLabel={`${label}. ${options.find((o) => o.id === id)!.hint}`}
              style={({ pressed }) => [
                styles.option,
                // The same keys in both states: Android mis-draws a background added later.
                { backgroundColor: on ? t.colors.primary : tint(t.colors.primary, 0.08), borderColor: on ? t.colors.primary : tint(t.colors.primary, 0.2), opacity: pressed || status.isPending ? 0.75 : 1 },
              ]}
            >
              <Icon size={18} color={on ? t.colors.primaryForeground : t.colors.primary} />
              <Text variant="label" style={{ color: on ? t.colors.primaryForeground : t.colors.primary }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" tone="muted">
        {options.find((o) => o.id === l.status)?.hint}
      </Text>
      <Pressable onPress={confirmDelete} disabled={remove.isPending} accessibilityRole="button" style={styles.delete}>
        <Trash2 size={18} color={t.colors.destructive} />
        <Text variant="label" style={{ color: t.colors.destructive }}>
          Delete listing
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", gap: 8 },
  option: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: MIN_TOUCH + 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1 },
  delete: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: MIN_TOUCH, alignSelf: "flex-start" },
});
