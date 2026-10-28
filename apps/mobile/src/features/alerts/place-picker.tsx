import type { AlertPlace } from "@myhoodora/api-contract/types";
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from "@maplibre/maplibre-react-native";
import { LocateFixed, MapPin, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { currentPosition, geocode, reverseGeocode } from "@/core/location/location";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { cleanLabel, LOCATE_PROBLEM, PLACE_LABEL_MAX, placeLabel, withinReach } from "./alert-place";
import { circle, MAP_STYLE } from "./hood-map";

export interface HoodArea {
  name: string;
  city?: string;
  /** [lng, lat] */
  centre: [number, number];
  radiusMeters: number;
}

/**
 * "Where is it?" for an alert, two ways (not everyone can drop a pin): type the street or area and we
 * find it on the map, or move the map under the pin (or use your location). Either way the map shows
 * the spot, with its name to check or change, before it's used.
 */
export function PlacePicker({ visible, hood, initial, onClose, onConfirm }: { visible: boolean; hood: HoodArea; initial: AlertPlace | null; onClose: () => void; onConfirm: (place: AlertPlace) => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {visible ? <Picker hood={hood} initial={initial} onClose={onClose} onConfirm={onConfirm} /> : null}
    </Modal>
  );
}

function Picker({ hood, initial, onClose, onConfirm }: { hood: HoodArea; initial: AlertPlace | null; onClose: () => void; onConfirm: (place: AlertPlace) => void }) {
  const t = useTheme();
  const user = useSignedInUser();
  const camera = useRef<CameraRef>(null);
  const start = initial ? { lat: initial.lat, lng: initial.lng } : { lat: hood.centre[1], lng: hood.centre[0] };
  const [point, setPoint] = useState(start);
  const [label, setLabel] = useState(initial?.label ?? "");
  // Once they've written the name themselves, moving the map no longer replaces it.
  const typedName = useRef(!!initial?.label);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const lookup = useRef(0);
  const area = useMemo(() => circle(hood.centre[0], hood.centre[1], hood.radiusMeters), [hood]);
  const centre = { lat: hood.centre[1], lng: hood.centre[0] };
  const ok = withinReach(centre, hood.radiusMeters, point);

  // The map settled somewhere new: suggest that place's name (unless they wrote their own).
  const settled = (lng: number, lat: number) => {
    setPoint({ lat, lng });
    if (typedName.current) return;
    const ticket = ++lookup.current;
    setNaming(true);
    void reverseGeocode(user, { lat, lng })
      .then((found) => ticket === lookup.current && setLabel(placeLabel(found)))
      .catch(() => undefined)
      .finally(() => ticket === lookup.current && setNaming(false));
  };

  const moveTo = (lat: number, lng: number) => camera.current?.easeTo({ center: [lng, lat], zoom: 16, duration: 500 });

  const search = async () => {
    const q = query.trim();
    if (q.length < 3 || busy) return;
    setBusy("search");
    setNote(null);
    try {
      // Looked for in the neighbourhood first, the way people say it ("Allen Avenue roundabout").
      const found = await geocode(user, { street: q, area: hood.name, city: hood.city ?? "" });
      typedName.current = true;
      setLabel(cleanLabel(q));
      moveTo(found.lat, found.lng);
      if (found.precision === "area") setNote(`We found ${hood.name}, not that exact spot. Move the map so the pin is on it.`);
    } catch {
      setNote("We couldn't find that. Try a nearby street or landmark, or move the map to the spot.");
    } finally {
      setBusy(null);
    }
  };

  const locate = async () => {
    if (busy) return;
    setBusy("locate");
    setNote(null);
    const res = await currentPosition();
    setBusy(null);
    if (res.ok) moveTo(res.coords.lat, res.coords.lng);
    else setNote(LOCATE_PROBLEM[res.reason]);
  };

  useEffect(() => {
    // The first suggestion, for a pin that hasn't moved yet.
    if (initial) return;
    let alive = true;
    void reverseGeocode(user, start)
      .then((found) => alive && !typedName.current && setLabel(placeLabel(found)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE[t.scheme === "dark" ? "dark" : "light"]}
        logo={false}
        attribution={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        onRegionDidChange={(e) => settled(e.nativeEvent.center[0], e.nativeEvent.center[1])}
      >
        <Camera ref={camera} initialViewState={{ center: [start.lng, start.lat], zoom: initial ? 16 : 14.5 }} />
        <GeoJSONSource id="hood" data={area}>
          <Layer type="fill" id="hood-fill" paint={{ "fill-color": "#147C73", "fill-opacity": 0.06 }} />
          <Layer type="line" id="hood-line" paint={{ "line-color": "#147C73", "line-width": 2, "line-dasharray": [2, 2] }} />
        </GeoJSONSource>
      </Map>

      {/* The pin stays in the middle; the map moves under it. Its tip marks the spot. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <MapPin size={44} color={ok ? t.colors.destructive : t.colors.mutedForeground} fill={t.colors.card} strokeWidth={2.2} />
        <View style={[styles.pinShadow, { backgroundColor: t.colors.foreground }]} />
      </View>

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close without choosing a place" style={[styles.round, { backgroundColor: t.colors.card }]}>
            <X size={22} color={t.colors.foreground} />
          </Pressable>
          <View style={[styles.search, { backgroundColor: t.colors.card }]}>
            <Search size={18} color={t.colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="Type a street, landmark or area"
              placeholderTextColor={t.colors.mutedForeground}
              returnKeyType="search"
              accessibilityLabel="Find a street, landmark or area"
              style={[styles.searchInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
            />
            {busy === "search" ? <ActivityIndicator color={t.colors.primary} /> : null}
          </View>
        </View>
        <Text variant="caption" style={[styles.hint, { backgroundColor: t.colors.card, color: t.colors.foreground }]}>
          Or move the map so the pin is on the spot.
        </Text>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.bottom} pointerEvents="box-none">
        <Pressable
          onPress={() => void locate()}
          accessibilityRole="button"
          accessibilityLabel="Use my location"
          style={[styles.round, styles.locate, { backgroundColor: t.colors.card }]}
        >
          {busy === "locate" ? <ActivityIndicator color={t.colors.primary} /> : <LocateFixed size={22} color={t.colors.primary} />}
        </Pressable>
        <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text variant="label">Where is it happening?</Text>
          {note ? (
            <Text variant="caption" tone="muted">
              {note}
            </Text>
          ) : null}
          <View style={[styles.nameBox, { borderColor: t.colors.border }]}>
            <MapPin size={18} color={t.colors.mutedForeground} />
            <TextInput
              value={label}
              onChangeText={(v) => {
                typedName.current = true;
                setLabel(v);
              }}
              maxLength={PLACE_LABEL_MAX}
              placeholder={naming ? "Finding the name…" : "Name the place, e.g. Allen Avenue roundabout"}
              placeholderTextColor={t.colors.mutedForeground}
              accessibilityLabel="The place's name"
              style={[styles.nameInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
            />
          </View>
          {ok ? null : (
            <Text variant="caption" tone="destructive">
              That&apos;s too far from {hood.name}. Alerts are for what&apos;s happening nearby.
            </Text>
          )}
          <Button label="Use this place" disabled={!ok} onPress={() => onConfirm({ lat: point.lat, lng: point.lng, ...(cleanLabel(label) && { label: cleanLabel(label) }) })} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The pin's tip (its bottom) sits on the map's centre.
  pinWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingBottom: 44 },
  pinShadow: { position: "absolute", top: "50%", width: 10, height: 4, borderRadius: 5, opacity: 0.25, marginTop: -2 },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: MIN_TOUCH, elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  hint: { alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  locate: { alignSelf: "flex-end" },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  nameBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: MIN_TOUCH },
  nameInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
});
