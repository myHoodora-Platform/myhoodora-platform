import { errorMessage } from "@myhoodora/api-contract/errors";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { usePhotoUploads } from "@/core/media/use-photo-uploads";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { PhotoStrip } from "@/shared/ui/photo-strip";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { CONDITION_OPTIONS, createListing, LISTING_CATEGORIES, listingErrors, listingKeys, type ListingForm, type ListingFormErrors } from "./listings-api";

/** Sell or give something away: photos first (they sell it), then the details. */
export function SellScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const photos = usePhotoUploads("listing", 10);
  const [form, setForm] = useState<ListingForm>({ title: "", description: "", price: "", free: false, negotiable: false, category: null, condition: null });
  const [errors, setErrors] = useState<ListingFormErrors | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/for-sale"));

  if (!hasHood(profile)) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]}>
        <EmptyState title="Join your neighbourhood to sell" body="Listings go to the neighbours around you, so confirm where you live first." />
      </SafeAreaView>
    );
  }
  const hoodId = profile.neighborhoodId;

  const edit = (patch: Partial<ListingForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => (e ? Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))) : e));
    setProblem(null);
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = listingErrors(form);
    setErrors(found);
    if (found) return;
    if (photos.uploading) return setProblem("Wait for your photos to finish uploading.");
    if (photos.failed) return setProblem("Some photos didn't upload. Retry or remove them first.");
    inFlight.current = true;
    setBusy(true);
    try {
      const listing = await createListing(user, hoodId, form, photos.urls);
      await client.invalidateQueries({ queryKey: listingKeys.all });
      toast(form.free ? "Listed for free. Neighbours can message you." : "Listed. Neighbours can message you.");
      router.replace(`/for-sale/${listing._id}`);
    } catch (err) {
      setProblem(errorMessage(err));
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close without listing" hitSlop={8} style={styles.close}>
          <X size={24} color={t.colors.foreground} />
        </Pressable>
        <Text variant="heading">Sell or give away</Text>
        <Button label="List" onPress={() => void submit()} loading={busy} style={styles.post} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {problem ? <InlineAlert>{problem}</InlineAlert> : null}
          <PhotoStrip uploads={photos} label="Photos (the first one is the cover)" />
          <TextField label="What is it?" placeholder="e.g. Standing fan, barely used" value={form.title} onChangeText={(title) => edit({ title })} maxLength={80} error={errors?.title} autoCapitalize="sentences" />
          <View style={[styles.toggle, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
            <View style={styles.flex}>
              <Text variant="label">Give it away for free</Text>
              <Text variant="caption" tone="muted">
                Free items go to a neighbour who needs them.
              </Text>
            </View>
            <Switch value={form.free} onValueChange={(free) => edit({ free })} accessibilityLabel="Give it away for free" trackColor={{ true: t.colors.primary, false: t.colors.input }} />
          </View>
          {!form.free ? (
            <>
              <TextField label="Price (₦)" placeholder="e.g. 25000" value={form.price} onChangeText={(price) => edit({ price })} keyboardType="number-pad" error={errors?.price} maxLength={13} />
              <View style={styles.inline}>
                <Switch value={form.negotiable} onValueChange={(negotiable) => edit({ negotiable })} accessibilityLabel="Price is negotiable" trackColor={{ true: t.colors.primary, false: t.colors.input }} />
                <Text>Price is negotiable</Text>
              </View>
            </>
          ) : null}
          <View style={styles.group}>
            <Text variant="label">Category</Text>
            <View style={styles.wrap}>
              {LISTING_CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.label} selected={form.category === c.id} onPress={() => edit({ category: c.id })} />
              ))}
            </View>
            {errors?.category ? <InlineAlert>{errors.category}</InlineAlert> : null}
          </View>
          <View style={styles.group}>
            <Text variant="label">Condition</Text>
            <View style={styles.wrap}>
              {CONDITION_OPTIONS.map((c) => (
                <Chip key={c.id} label={c.label} selected={form.condition === c.id} onPress={() => edit({ condition: c.id })} />
              ))}
            </View>
            {errors?.condition ? <InlineAlert>{errors.condition}</InlineAlert> : null}
          </View>
          <TextField
            label="Description (optional)"
            placeholder="Size, age, why you're selling, where to pick it up"
            value={form.description}
            onChangeText={(description) => edit({ description })}
            multiline
            maxLength={1500}
            error={errors?.description}
          />
          <Text variant="caption" tone="muted">
            Meet in a public place, and never send money before you&apos;ve seen the item.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  post: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 20, borderRadius: 999 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  group: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
