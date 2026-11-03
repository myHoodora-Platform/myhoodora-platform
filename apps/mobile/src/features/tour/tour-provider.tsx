import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { cardPlacement, holePath, isOnScreen, spotlight, type Rect } from "./placement";

export interface TourStep {
  /** The `tourTarget(id)` of the element to highlight. */
  target: string;
  title: string;
  body: string;
}

export type TourEnd = "completed" | "skipped";

interface TourContextValue {
  /** A stable ref callback for an element a tour can point at. Several may share an id (a header on every tab). */
  tourTarget: (id: string) => (node: View | null) => void;
  start: (steps: TourStep[], onEnd: (how: TourEnd) => void) => void;
  running: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour outside TourProvider");
  return value;
}

/** For the tab bar and other shared parts: a no-op outside the signed-in app. */
export function useTourTarget(id: string): ((node: View | null) => void) | undefined {
  return useContext(TourContext)?.tourTarget(id);
}

function measure(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Coach marks, as on the web (features/tour): the screen dims, one element at a time is lit with a
 * short card beside it. Skip or Android's back ends it at any point; a step whose element isn't on
 * screen is passed over, so a missing element can never strand anyone on a dimmed screen.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string, Set<View>>());
  const refs = useRef(new Map<string, (node: View | null) => void>());
  const [tour, setTour] = useState<{ steps: TourStep[]; onEnd: (how: TourEnd) => void } | null>(null);

  const tourTarget = useCallback((id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      let current: View | null = null;
      ref = (node: View | null) => {
        const set = nodes.current.get(id) ?? new Set<View>();
        if (current) set.delete(current);
        if (node) set.add(node);
        current = node;
        nodes.current.set(id, set);
      };
      refs.current.set(id, ref);
    }
    return ref;
  }, []);

  /** The first of the id's elements that is on screen now. */
  const locate = useCallback(async (id: string, screen: { width: number; height: number }): Promise<Rect | null> => {
    for (const node of nodes.current.get(id) ?? []) {
      const rect = await measure(node);
      if (rect && isOnScreen(rect, screen)) return rect;
    }
    return null;
  }, []);

  const start = useCallback((steps: TourStep[], onEnd: (how: TourEnd) => void) => setTour({ steps, onEnd }), []);
  const end = useCallback(
    (how: TourEnd) => {
      tour?.onEnd(how);
      setTour(null);
    },
    [tour],
  );

  const value = useMemo(() => ({ tourTarget, start, running: !!tour }), [tourTarget, start, tour]);
  return (
    <TourContext.Provider value={value}>
      {children}
      {tour ? <TourOverlay steps={tour.steps} locate={locate} onEnd={end} /> : null}
    </TourContext.Provider>
  );
}

function TourOverlay({ steps, locate, onEnd }: { steps: TourStep[]; locate: (id: string, screen: { width: number; height: number }) => Promise<Rect | null>; onEnd: (how: TourEnd) => void }) {
  const t = useTheme();
  const screen = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // The lit area, for the step it was measured for (a new step waits for its own).
  const [found, setFound] = useState<{ index: number; rect: Rect } | null>(null);
  const spot = found?.index === index ? found.rect : null;
  const step = steps[index];
  const last = index === steps.length - 1;

  // Find this step's element; if it isn't there, go on to the next (or finish).
  useEffect(() => {
    if (!step) return;
    let alive = true;
    void locate(step.target, screen).then((rect) => {
      if (!alive) return;
      if (rect) {
        setFound({ index, rect: spotlight(rect, screen) });
        AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
      } else if (last) onEnd("completed");
      else setIndex((i) => i + 1);
    });
    return () => {
      alive = false;
    };
  }, [step, index, last, locate, onEnd, screen]);

  const next = () => (last ? onEnd("completed") : setIndex((i) => i + 1));
  const place = spot ? cardPlacement(spot, screen) : null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => onEnd("skipped")}>
      {/* Taps outside the card do nothing: the app underneath waits until the tour is done. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => undefined}>
        <Svg width={screen.width} height={screen.height} style={StyleSheet.absoluteFill}>
          <Path d={spot ? holePath(spot, screen) : `M0 0H${screen.width}V${screen.height}H0Z`} fill="rgba(0,0,0,0.62)" fillRule="evenodd" />
        </Svg>
        {spot ? (
          <Animated.View
            key={`ring-${index}`}
            entering={FadeIn.duration(220)}
            pointerEvents="none"
            style={[styles.ring, { left: spot.x, top: spot.y, width: spot.width, height: spot.height, borderColor: t.colors.primary }]}
          />
        ) : null}
      </Pressable>
      {spot && place && step ? (
        <Animated.View
          key={`card-${index}`}
          entering={FadeInDown.duration(260)}
          accessibilityViewIsModal
          style={[styles.card, place, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
        >
          <Text variant="caption" tone="primary" style={{ fontFamily: t.fonts.semibold }}>
            {index + 1} of {steps.length}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {step.title}
          </Text>
          <Text tone="muted">{step.body}</Text>
          <View style={styles.row}>
            <View style={styles.dots} accessible={false}>
              {steps.map((s, i) => (
                <View key={s.target} style={[styles.dot, { backgroundColor: i === index ? t.colors.primary : t.colors.border, width: i === index ? 18 : 6 }]} />
              ))}
            </View>
            {last ? null : (
              <Pressable onPress={() => onEnd("skipped")} accessibilityRole="button" hitSlop={10} style={styles.skip}>
                <Text variant="label" tone="muted">
                  Skip
                </Text>
              </Pressable>
            )}
            <Button label={last ? "Done" : "Next"} onPress={next} style={styles.next} />
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute", borderWidth: 3, borderRadius: 16 },
  card: { position: "absolute", left: 16, right: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  dots: { flexDirection: "row", gap: 5, flex: 1 },
  dot: { height: 6, borderRadius: 3 },
  skip: { paddingHorizontal: 6, paddingVertical: 8 },
  next: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 22 },
});
