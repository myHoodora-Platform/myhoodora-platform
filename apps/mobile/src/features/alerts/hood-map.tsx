import type { ApiPost } from "@myhoodora/api-contract/types";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Home } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { alertKind } from "./alert-kinds";
import { alertStatus } from "./alert-lifecycle";

/**
 * The same free, keyless tiles as the web's maps (OpenFreeMap, OpenStreetMap data), in the app's
 * light or dark look.
 */
export const MAP_STYLE = { light: "https://tiles.openfreemap.org/styles/liberty", dark: "https://tiles.openfreemap.org/styles/dark" } as const;
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

/** Alerts that said where they are. */
export const pinned = (posts: ApiPost[]) => posts.filter((p): p is ApiPost & { location: NonNullable<ApiPost["location"]> } => !!p.location);

/** An alert's pin: its kind's icon, red while urgent or active, grey once it's over. */
export function AlertPin({ post, selected = false, now }: { post: ApiPost; selected?: boolean; now: number }) {
  const t = useTheme();
  const kind = alertKind(post.alertCategory);
  const status = alertStatus(post, now);
  const live = status === "urgent" || status === "active";
  const bg = status === "urgent" ? t.colors.destructive : live ? t.colors.warning : t.colors.mutedForeground;
  return (
    <View collapsable={false} style={[styles.pin, { backgroundColor: bg, borderColor: selected ? t.colors.foreground : t.colors.card, transform: [{ scale: selected ? 1.2 : 1 }] }]}>
      <kind.Icon size={16} color="#FFFFFF" />
    </View>
  );
}

/**
 * Your neighbourhood on a map (the web's Alerts map): its boundary, its centre, and a pin for each
 * alert that said where. A picture to orient by inside the list (no gestures); tap it for the
 * full-screen map.
 */
export function HoodMap({ lng, lat, radiusMeters, name, alerts = [], now, onOpen }: { lng: number; lat: number; radiusMeters: number; name: string; alerts?: ApiPost[]; now: number; onOpen?: () => void }) {
  const t = useTheme();
  const shape = useMemo(() => circle(lng, lat, radiusMeters), [lng, lat, radiusMeters]);
  const bounds = useMemo(() => circleBounds(lng, lat, radiusMeters), [lng, lat, radiusMeters]);
  const pins = pinned(alerts);
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      style={styles.fill}
      accessibilityRole={onOpen ? "button" : "image"}
      accessibilityLabel={`Map of ${name}${pins.length ? `, ${pins.length} alert${pins.length > 1 ? "s" : ""} pinned` : ""}${onOpen ? ". Opens the full map" : ""}`}
    >
      <View style={styles.fill} pointerEvents="none">
        <Map
          style={styles.fill}
          mapStyle={MAP_STYLE[t.scheme === "dark" ? "dark" : "light"]}
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
          {pins.length ? null : (
            <Marker id="hood-centre" lngLat={[lng, lat]}>
              <View style={[styles.home, { backgroundColor: t.colors.foreground, borderColor: t.colors.card }]}>
                <Home size={16} color={t.colors.background} />
              </View>
            </Marker>
          )}
          {pins.map((p) => (
            <Marker key={p._id} id={`alert-${p._id}`} lngLat={[p.location.lng, p.location.lat]}>
              <AlertPin post={p} now={now} />
            </Marker>
          ))}
        </Map>
        {/* The tiles' licence asks for this credit. */}
        <View style={[styles.credit, { backgroundColor: t.colors.card }]}>
          <Text style={[styles.creditText, { color: t.colors.mutedForeground }]}>© OpenFreeMap © OpenStreetMap</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  credit: { position: "absolute", right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopLeftRadius: 8, opacity: 0.85 },
  creditText: { fontSize: 10, lineHeight: 13 },
  home: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  pin: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
});
