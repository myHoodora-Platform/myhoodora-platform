import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import { addressIssue, EMPTY_ADDRESS, joinAddress, type AddressParts } from "@myhoodora/api-contract/lookups";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { ChevronRight, LocateFixed, Search, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { currentPosition, geocode, POSITION_PROBLEM, reverseGeocode, type Coords } from "@/core/location/location";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { HoodMapBadge } from "@/shared/ui/hood-map-badge";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { hoodKeys, listHoods, myHoods, nearbyHoods, requestHoodChange } from "./account-api";
import { followable, REASON_MAX, REASON_SUGGESTIONS, reasonProblem } from "./account-rules";
import { FormScrollView } from "@/shared/ui/form-scroll-view";

/** How many close neighbourhoods to suggest first. */
const NEAR_HOME_COUNT = 5;

/** Shared by both forms: submit once, show the API's words, go back with a toast. */
function useSubmit() {
  const router = useRouter();
  const toast = useToast();
  const client = useQueryClient();
  const { refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = async (work: () => Promise<unknown>, done: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await work();
      await client.invalidateQueries({ queryKey: hoodKeys.mine });
      void refreshProfile();
      toast(done);
      if (router.canGoBack()) router.back();
      else router.replace("/settings/neighbourhoods");
    } catch (err) {
      setProblem(err instanceof ApiError && err.kind === "client" ? err.message : errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, problem, setProblem, run };
}

// ── Follow another neighbourhood ────────────────────────────────────────────

/** `/settings/neighbourhoods/add`: choose, then say why. The list never pushes the button out of reach. */
export function AddHoodScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const [chosen, setChosen] = useState<{ id: string; name: string; city: string } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const submit = useSubmit();

  const send = () => {
    if (!chosen) return;
    const problem = reasonProblem(reason);
    setReasonError(problem);
    if (problem) return;
    void submit.run(() => requestHoodChange(user, { kind: "secondary", hoodId: chosen.id, reason: reason.trim() }), `Request sent. We'll let you know about ${chosen.name}.`);
  };

  // The action rides above the keyboard, so it's never hidden while typing the reason.
  const footer = chosen ? (
    <GlassSurface style={[styles.footer, { borderTopColor: t.colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Button label={`Ask to follow ${chosen.name}`} onPress={send} loading={submit.busy} />
    </GlassSurface>
  ) : undefined;

  return (
    <AppScreen title="Follow a neighbourhood" fallback="/settings/neighbourhoods" footer={footer}>
      {chosen ? (
        <WhyStep
          hood={chosen}
          onChange={() => setChosen(null)}
          reason={reason}
          setReason={(v) => {
            setReason(v);
            setReasonError(null);
          }}
          error={reasonError}
          problem={submit.problem}
        />
      ) : (
        <ChooseStep onChoose={setChosen} />
      )}
    </AppScreen>
  );
}

/** Step 1: search pinned at the top, city chips with your own city first, compact rows. */
function ChooseStep({ onChoose }: { onChoose: (h: { id: string; name: string; city: string }) => void }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const all = useQuery({ queryKey: hoodKeys.all, queryFn: () => listHoods(user), staleTime: 5 * 60_000 });
  const mine = useQuery({ queryKey: hoodKeys.mine, queryFn: () => myHoods(user) });
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const homeCity = mine.data?.home?.city;
  const exclude = useMemo(
    () =>
      new Set([
        profile?.neighborhoodId ?? "",
        ...(mine.data?.secondary.map((h) => h.id) ?? []),
        ...(mine.data?.requests.filter((r) => r.status === "pending" && r.hood).map((r) => r.hood!.id) ?? []),
      ]),
    [profile?.neighborhoodId, mine.data],
  );
  const groups = useMemo(() => followable(all.data ?? [], exclude, query, homeCity), [all.data, exclude, query, homeCity]);
  const cities = groups.map((g) => g.city);
  // The likeliest picks first: the closest to home (where people work, shop, have family).
  const home = profile?.location;
  const near = useQuery({
    queryKey: ["neighborhoods", "near-home", home?.lat, home?.lng],
    queryFn: () => nearbyHoods(user, { lat: home!.lat!, lng: home!.lng! }),
    enabled: typeof home?.lat === "number" && typeof home?.lng === "number",
    staleTime: 10 * 60_000,
  });
  const sections = useMemo(() => {
    const byCity = groups.filter((g) => !city || g.city === city).map((g) => ({ title: g.city, data: g.hoods }));
    const close = (near.data ?? []).filter((h) => !exclude.has(h._id)).slice(0, NEAR_HOME_COUNT);
    return !query && !city && close.length ? [{ title: "Near your home", data: close }, ...byCity] : byCity;
  }, [groups, city, query, near.data, exclude]);

  if (all.isError && !all.data) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Pinned: search and cities stay in reach however far the list scrolls. */}
      <View style={[styles.pinned, { borderBottomColor: t.colors.border, backgroundColor: t.colors.canvas }]}>
        <View style={[styles.search, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Search size={18} color={t.colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search neighbourhoods or cities"
            placeholderTextColor={t.colors.mutedForeground}
            accessibilityLabel="Search neighbourhoods"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
              <X size={18} color={t.colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {cities.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityChips} keyboardShouldPersistTaps="handled">
            <Chip label="All cities" selected={!city} onPress={() => setCity(null)} />
            {cities.map((c) => (
              <Chip key={c} label={c === homeCity ? `${c} (yours)` : c} selected={city === c} onPress={() => setCity(c)} />
            ))}
          </ScrollView>
        ) : null}
      </View>
      {all.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(h, i) => `${h._id}-${i}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderSectionHeader={({ section }) => (
            <Text variant="caption" tone="muted" style={[styles.sectionHead, { backgroundColor: t.colors.canvas }]}>
              {section.title === "Near your home" ? "NEAR YOUR HOME" : `${section.title.toUpperCase()} · ${section.data.length}`}
            </Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onChoose({ id: item._id, name: item.name, city: item.city })}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.city}`}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.muted : t.colors.card, borderBottomColor: t.colors.border }]}
            >
              <Text style={styles.flex}>{item.name}</Text>
              <ChevronRight size={18} color={t.colors.mutedForeground} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text tone="muted" style={styles.empty}>
              {query ? `No neighbourhood matches “${query}”.` : "There are no other neighbourhoods to follow yet."}
            </Text>
          }
        />
      )}
    </View>
  );
}

/** Step 2: the chosen neighbourhood, one-tap reason suggestions, and the reason. */
function WhyStep({
  hood,
  onChange,
  reason,
  setReason,
  error,
  problem,
}: {
  hood: { id: string; name: string; city: string };
  onChange: () => void;
  reason: string;
  setReason: (v: string) => void;
  error: string | null;
  problem: string | null;
}) {
  const t = useTheme();
  const insets = useScreenInsets();
  return (
    <FormScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" scrollIndicatorInsets={{ top: insets.top }}>
      <View style={[styles.chosen, { backgroundColor: t.colors.card, borderColor: t.colors.primary }]}>
        <HoodMapBadge size={44} />
        <View style={styles.flex}>
          <Text variant="heading">{hood.name}</Text>
          <Text variant="caption" tone="muted">
            {hood.city} · read and alerts; you still post at home
          </Text>
        </View>
        <Text variant="label" tone="primary" onPress={onChange} accessibilityRole="button">
          Change
        </Text>
      </View>
      {problem ? <InlineAlert>{problem}</InlineAlert> : null}
      <View style={styles.list}>
        <Text variant="label">{`Why ${hood.name}?`}</Text>
        {/* One row that scrolls sideways: the text box stays high, above the keyboard. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow} keyboardShouldPersistTaps="handled" style={styles.bleed}>
          {REASON_SUGGESTIONS.map((r) => (
            <Chip key={r} label={r} selected={reason.startsWith(r)} onPress={() => setReason(reason.trim() && !REASON_SUGGESTIONS.some((x) => reason.startsWith(x)) ? reason : `${r}: `)} />
          ))}
        </ScrollView>
      </View>
      <TextField
        label="Tell us a little more"
        placeholder="e.g. I'm a nurse at the general hospital there"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={REASON_MAX}
        hint={`${reason.trim().length} / ${REASON_MAX} · our team reviews each request`}
        error={error}
      />
    </FormScrollView>
  );
}

// ── Ask to move ─────────────────────────────────────────────────────────────

/** `/settings/neighbourhoods/move` */
export function MoveRequestScreen() {
  return (
    <AppScreen title="Ask to move" fallback="/settings/neighbourhoods">
      <MoveContent />
    </AppScreen>
  );
}

function MoveContent() {
  const t = useTheme();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const [address, setAddress] = useState<AddressParts>(EMPTY_ADDRESS);
  const [point, setPoint] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ address?: string; reason?: string } | null>(null);
  const submit = useSubmit();

  const edit = (patch: Partial<AddressParts>) => {
    setAddress((a) => ({ ...a, ...patch }));
    setErrors((e) => (e ? { ...e, address: undefined } : e));
  };

  const locate = async () => {
    setLocating(true);
    setLocateNote(null);
    try {
      const position = await currentPosition();
      if (!position.ok) return setLocateNote(POSITION_PROBLEM[position.reason]);
      setPoint(position.coords);
      const place = await reverseGeocode(user, position.coords).catch(() => null);
      if (place) setAddress(place.parts);
      setLocateNote("Location found. Check the address below.");
    } finally {
      setLocating(false);
    }
  };

  const send = () => {
    const found: { address?: string; reason?: string } = {};
    const issue = addressIssue(address);
    if (issue) found.address = issue.message;
    const r = reasonProblem(reason);
    if (r) found.reason = r;
    setErrors(Object.keys(found).length ? found : null);
    if (Object.keys(found).length) return;
    void submit.run(async () => {
      // The phone's location if they used it; otherwise the typed address, looked up.
      let at = point;
      if (!at) {
        const match = await geocode(user, address).catch(() => null);
        if (!match) throw new ApiError("We couldn't find that address. Check the street and area, or use your current location.", 400, "client");
        at = { lat: match.lat, lng: match.lng };
      }
      await requestHoodChange(user, { kind: "move", address: joinAddress(address), lat: at.lat, lng: at.lng, reason: reason.trim() });
    }, "Request sent. Our team will be in touch.");
  };

  return (
    <FormScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" scrollIndicatorInsets={{ top: insets.top }}>
      <Text tone="muted">Tell us your new address and we&apos;ll move you to the right neighbourhood. Our team checks every move, so neighbourhoods stay local and trusted. Your address is never shown to neighbours.</Text>
      {submit.problem ? <InlineAlert>{submit.problem}</InlineAlert> : null}
      <Pressable
        onPress={() => void locate()}
        disabled={locating}
        accessibilityRole="button"
        style={({ pressed }) => [styles.locate, { borderColor: point ? t.colors.primary : t.colors.border, backgroundColor: pressed || point ? tint(t.colors.primary, 0.06) : t.colors.card }]}
      >
        <View style={[styles.locateIcon, { backgroundColor: t.colors.primary }]}>
          {locating ? <ActivityIndicator color={t.colors.primaryForeground} /> : <LocateFixed size={20} color={t.colors.primaryForeground} />}
        </View>
        <View style={styles.flex}>
          <Text variant="label">{point ? "Using your current location" : "Use my current location"}</Text>
          <Text variant="caption" tone="muted">
            {locateNote ?? "Best done at your new home."}
          </Text>
        </View>
      </Pressable>
      <TextField label="House number and street" placeholder="e.g. 4 Herbert Macaulay Way" value={address.street} onChangeText={(street) => edit({ street })} autoCapitalize="words" autoComplete="address-line1" />
      <TextField label="Area or estate" placeholder="e.g. Yaba" value={address.area} onChangeText={(area) => edit({ area })} autoCapitalize="words" />
      <TextField label="City" placeholder="e.g. Lagos" value={address.city} onChangeText={(city) => edit({ city })} autoCapitalize="words" error={errors?.address} />
      <TextField
        label="Anything we should know?"
        placeholder="e.g. We moved house last month"
        value={reason}
        onChangeText={(v) => {
          setReason(v);
          setErrors((e) => (e ? { ...e, reason: undefined } : e));
        }}
        multiline
        maxLength={REASON_MAX}
        error={errors?.reason}
      />
      <Button label="Send request" onPress={send} loading={submit.busy} />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  flex: { flex: 1 },
  list: { gap: 8 },
  pinned: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cityChips: { gap: 8 },
  suggestionRow: { gap: 8, paddingHorizontal: 16 },
  bleed: { marginHorizontal: -16 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  loading: { padding: 16, gap: 8 },
  sectionHead: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: MIN_TOUCH + 4, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { padding: 24, textAlign: "center" },
  chosen: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, minHeight: MIN_TOUCH },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  locate: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1.5, borderRadius: 16 },
  locateIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
