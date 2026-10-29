import type { ApiPost } from "@myhoodora/api-contract/types";
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from "@maplibre/maplibre-react-native";
import { ArrowLeft, ChevronRight, MapPin, Plus } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { timeAgo } from "@/shared/utils/time";
import { postText } from "@/features/feed/post-parts";
import { alertKind } from "./alert-kinds";
import { alertStatus } from "./alert-lifecycle";
import { useHoodArea, useRecentAlerts } from "./alerts-data";
import { AlertPin, circle, circleBounds, MAP_STYLE, pinned } from "./hood-map";

const STATUS_LABEL = { urgent: "Urgent", active: "Active", resolved: "Resolved", ended: "Ended" } as const;

/**
 * `/alerts/map`: the week's alerts on a full-screen map (Nextdoor's map-first alerts). Tap a pin for
 * the alert, then open it. Only alerts whose poster said where appear here; the list has them all.
 */
export function AlertsMapScreen() {
  const { profile } = useAuth();
  if (!hasHood(profile)) return <EmptyState title="Join your neighbourhood first" body="Alerts come from the verified neighbours around you." />;
  return <AlertsMap hoodId={profile.neighborhoodId} />;
}

function AlertsMap({ hoodId }: { hoodId: string }) {
  const t = useTheme();
  const router = useRouter();
  const camera = useRef<CameraRef>(null);
  const [now] = useState(() => Date.now());
  const { all } = useRecentAlerts(hoodId, now);
  const { area, name } = useHoodArea(hoodId);
  const pins = pinned(all);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = pins.find((p) => p._id === selected) ?? null;
  const shape = useMemo(() => (area ? circle(area.centre[0], area.centre[1], area.radiusMeters) : null), [area]);

  const choose = (p: ApiPost & { location: NonNullable<ApiPost["location"]> }) => {
    setSelected(p._id);
    camera.current?.easeTo({ center: [p.location.lng, p.location.lat], duration: 300 });
  };

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      {area ? (
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE[t.scheme === "dark" ? "dark" : "light"]}
          logo={false}
          attribution={false}
          compass={false}
          touchPitch={false}
          onPress={() => setSelected(null)}
        >
          <Camera ref={camera} initialViewState={{ bounds: circleBounds(area.centre[0], area.centre[1], area.radiusMeters), padding: { top: 120, right: 24, bottom: 220, left: 24 } }} />
          {shape ? (
            <GeoJSONSource id="hood" data={shape}>
              <Layer type="fill" id="hood-fill" paint={{ "fill-color": "#147C73", "fill-opacity": 0.06 }} />
              <Layer type="line" id="hood-line" paint={{ "line-color": "#147C73", "line-width": 2, "line-dasharray": [2, 2] }} />
            </GeoJSONSource>
          ) : null}
          {pins.map((p) => (
            <Marker key={p._id} id={`alert-${p._id}`} lngLat={[p.location.lng, p.location.lat]} onPress={() => choose(p)}>
              <AlertPin post={p} now={now} selected={p._id === selected} />
            </Marker>
          ))}
        </Map>
      ) : null}

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[styles.round, { backgroundColor: t.colors.card }]}>
            <ArrowLeft size={22} color={t.colors.foreground} />
          </Pressable>
          <View style={[styles.title, { backgroundColor: t.colors.card }]}>
            <Text variant="label" numberOfLines={1}>
              Alerts in {name ?? "your neighbourhood"}
            </Text>
            <Text variant="caption" tone="muted">
              {pins.length ? `${pins.length} on the map this week` : "None with a place this week"}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/compose?kind=alert")} accessibilityRole="button" accessibilityLabel="Post an alert" style={[styles.round, { backgroundColor: t.colors.primary }]}>
            <Plus size={22} color={t.colors.primaryForeground} />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.bottom} pointerEvents="box-none">
        {chosen ? (
          <Animated.View key={chosen._id} entering={FadeInDown.duration(200)}>
            <Pressable
              onPress={() => router.push(`/p/${chosen._id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${alertKind(chosen.alertCategory).label} alert${chosen.location.label ? ` at ${chosen.location.label}` : ""}. Opens the alert`}
              style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            >
              <View style={styles.cardHead}>
                <AlertPin post={chosen} now={now} />
                <View style={styles.flex}>
                  <Text variant="label">
                    {alertKind(chosen.alertCategory).label} · {STATUS_LABEL[alertStatus(chosen, now)]}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {chosen.author?.displayName ?? "A neighbour"} · {timeAgo(chosen.createdAt, now)}
                  </Text>
                </View>
                <ChevronRight size={20} color={t.colors.mutedForeground} />
              </View>
              {chosen.location.label ? (
                <View style={styles.place}>
                  <MapPin size={14} color={t.colors.mutedForeground} />
                  <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                    {chosen.location.label}
                  </Text>
                </View>
              ) : null}
              <Text numberOfLines={3}>{postText(chosen)}</Text>
            </Pressable>
          </Animated.View>
        ) : pins.length ? null : (
          <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text variant="label">No alerts on the map yet</Text>
            <Text variant="caption" tone="muted">
              When neighbours say where something is happening, it shows here. The Alerts list has every alert.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const shadow = { elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } as const;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 12 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center", ...shadow },
  title: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, ...shadow },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12 },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8, ...shadow },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  place: { flexDirection: "row", alignItems: "center", gap: 6 },
});
