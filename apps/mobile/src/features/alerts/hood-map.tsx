import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Home } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";

/**
 * The same free, keyless tiles as the web's maps (OpenFreeMap, OpenStreetMap data), in the app's
 * light or dark look.
 */
const STYLE = { light: "https://tiles.openfreemap.org/styles/liberty", dark: "https://tiles.openfreemap.org/styles/dark" } as const;
const BRAND = "#147C73";

/** A GeoJSON polygon approximating a circle of `radiusM` metres. */
export function circle(lng: number, lat: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** [west, south, east, north] around the circle, with a little room. */
export function circleBounds(lng: number, lat: number, radiusM: number): [number, number, number, number] {
  const dLat = (radiusM * 1.15) / 111_320;
  const dLng = (radiusM * 1.15) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Your neighbourhood on a map (the web's Alerts map): its boundary and its centre. A picture to
 * orient by, so it doesn't take touches from the list it sits in. Alerts don't carry a location yet,
 * so there are no pins (as on the web).
 */
export function HoodMap({ lng, lat, radiusMeters, name }: { lng: number; lat: number; radiusMeters: number; name: string }) {
  const t = useTheme();
  const shape = useMemo(() => circle(lng, lat, radiusMeters), [lng, lat, radiusMeters]);
  const bounds = useMemo(() => circleBounds(lng, lat, radiusMeters), [lng, lat, radiusMeters]);
  return (
    <View style={styles.fill} accessible accessibilityRole="image" accessibilityLabel={`Map of ${name}`} pointerEvents="none">
      <Map
        style={styles.fill}
        mapStyle={STYLE[t.scheme === "dark" ? "dark" : "light"]}
        dragPan={false}
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution={false}
      >
        <Camera initialViewState={{ bounds, padding: { top: 12, right: 12, bottom: 12, left: 12 } }} />
        <GeoJSONSource id="hood" data={shape}>
          <Layer type="fill" id="hood-fill" paint={{ "fill-color": BRAND, "fill-opacity": 0.1 }} />
          <Layer type="line" id="hood-line" paint={{ "line-color": BRAND, "line-width": 2, "line-dasharray": [2, 2] }} />
        </GeoJSONSource>
        <Marker id="hood-centre" lngLat={[lng, lat]}>
          <View style={[styles.pin, { backgroundColor: t.colors.foreground, borderColor: t.colors.card }]}>
            <Home size={16} color={t.colors.background} />
          </View>
        </Marker>
      </Map>
      {/* The tiles' licence asks for this credit; the map takes no touches, so it's text, not a button. */}
      <View style={[styles.credit, { backgroundColor: t.colors.card }]}>
        <Text style={[styles.creditText, { color: t.colors.mutedForeground }]}>© OpenFreeMap © OpenStreetMap</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  credit: { position: "absolute", right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopLeftRadius: 8, opacity: 0.85 },
  creditText: { fontSize: 10, lineHeight: 13 },
  pin: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
});
