import { SEASON_PALETTES, SEASON_PARTICLES, type Season } from "@myhoodora/api-contract/seasons";
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFixedHeaderHeight } from "@/shared/ui/header-height";
import { useSeason } from "./use-season";

/** The moving part plays this long after the app opens (or comes back), then only still lights stay. */
const PLAY_MS = 8_000;

/**
 * The season's look over the signed-in app (plan WP-D): lights along the top, a few sparkles, or a
 * fireworks burst. Never blocks a tap (pointerEvents none), few particles, stops after a few seconds and
 * while the app is in the background; "reduce motion" and the Festive effects switch leave it still or off.
 */
export function SeasonOverlay() {
  const { season, effects, reducedMotion } = useSeason();
  const [round, setRound] = useState(0);
  // Back from the background: one more short show.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && setRound((n) => n + 1));
    return () => sub.remove();
  }, []);
  if (!season || !effects || season.effect === "none") return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Lights season={season} still={reducedMotion} key={`l${round}`} />
      {!reducedMotion && season.effect === "sparkle" ? <Sparkles season={season} key={`s${round}`} /> : null}
      {!reducedMotion && season.effect === "fireworks" ? <Fireworks season={season} key={`f${round}`} /> : null}
    </View>
  );
}

function Lights({ season, still }: { season: Season; still: boolean }) {
  const insets = useSafeAreaInsets();
  const header = useFixedHeaderHeight();
  const { width } = useWindowDimensions();
  const colours = SEASON_PALETTES[season.accent];
  const n = Math.max(10, Math.round(width / 26));
  // Strung along the header's foot (as on the web), never over its buttons; a typical header until it measures.
  return (
    <View style={[styles.wire, { top: (header || insets.top + 56) - 1 }]}>
      {Array.from({ length: n }, (_, i) => (
        <Bulb key={i} colour={colours[i % colours.length]!} delay={(i % 5) * 320} still={still} />
      ))}
    </View>
  );
}

function Bulb({ colour, delay, still }: { colour: string; delay: number; still: boolean }) {
  const glow = useSharedValue(1);
  useEffect(() => {
    if (still) return;
    glow.value = withDelay(delay, withRepeat(withSequence(withTiming(0.35, { duration: 800 }), withTiming(1, { duration: 800 })), Math.ceil((PLAY_MS * 2) / 1600), false));
    return () => cancelAnimation(glow);
  }, [glow, delay, still]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <View style={styles.socket}>
      <View style={styles.cap} />
      <Animated.View style={[styles.bulb, { backgroundColor: colour, shadowColor: colour }, style]} />
    </View>
  );
}

function Sparkles({ season }: { season: Season }) {
  const { width, height } = useWindowDimensions();
  const colours = SEASON_PALETTES[season.accent];
  const sparks = useMemo(
    () => Array.from({ length: SEASON_PARTICLES[season.intensity] }, (_, i) => ({ x: ((i * 37) % 100) / 100, size: 6 + ((i * 7) % 7), delay: (i % 8) * 450, duration: 4500 + ((i * 13) % 30) * 100, colour: colours[i % colours.length]! })),
    [season.intensity, colours],
  );
  return (
    <>
      {sparks.map((s, i) => (
        <Spark key={i} left={s.x * width} fall={height * 0.7} size={s.size} delay={s.delay} duration={s.duration} colour={s.colour} />
      ))}
    </>
  );
}

function Spark({ left, fall, size, delay, duration, colour }: { left: number; fall: number; size: number; delay: number; duration: number; colour: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }));
    return () => cancelAnimation(p);
  }, [p, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - p.value,
    transform: [{ translateY: p.value * fall }, { rotate: `${p.value * 180}deg` }, { scale: 0.6 + p.value * 0.4 }],
  }));
  return <Animated.View style={[styles.spark, { left, width: size, height: size, backgroundColor: colour }, style]} />;
}

/** A handful of bursts: each a ring of dots flying out and fading. */
function Fireworks({ season }: { season: Season }) {
  const { width, height } = useWindowDimensions();
  const colours = SEASON_PALETTES[season.accent];
  const per = Math.round(SEASON_PARTICLES[season.intensity] / 1.5);
  const bursts = useMemo(
    () => Array.from({ length: 6 }, (_, b) => ({ x: width * (0.15 + ((b * 0.37) % 0.7)), y: height * (0.12 + ((b * 0.23) % 0.25)), delay: b * 900, colour: colours[b % colours.length]! })),
    [width, height, colours],
  );
  return (
    <>
      {bursts.map((b, i) =>
        Array.from({ length: per }, (_, j) => <Ember key={`${i}-${j}`} x={b.x} y={b.y} angle={(j / per) * Math.PI * 2} delay={b.delay} colour={b.colour} />),
      )}
    </>
  );
}

function Ember({ x, y, angle, delay, colour }: { x: number; y: number; angle: number; delay: number; colour: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [{ translateX: Math.cos(angle) * 90 * p.value }, { translateY: Math.sin(angle) * 90 * p.value + 40 * p.value * p.value }],
  }));
  return <Animated.View style={[styles.ember, { left: x, top: y, backgroundColor: colour }, style]} />;
}

const styles = StyleSheet.create({
  wire: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "rgba(62,74,61,0.6)" },
  socket: { alignItems: "center" },
  cap: { width: 4, height: 3, backgroundColor: "#3e4a3d" },
  bulb: { width: 7, height: 11, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  spark: { position: "absolute", top: -10, transform: [{ rotate: "45deg" }], borderRadius: 2 },
  ember: { position: "absolute", width: 4, height: 4, borderRadius: 2 },
});
