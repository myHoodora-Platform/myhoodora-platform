import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "@/shared/hooks/use-keyboard-height";
import { useReducedMotion } from "@/shared/hooks/use-reduced-motion";
import { useTheme } from "@/shared/theme/theme";

/** Sizes the sheet rests at, as parts of the screen's height: where it opens, and pulled up. */
const DETENTS = [0.6, 0.95] as const;
/** By default a short thread still opens at least this tall, so the sheet never looks cramped. */
const MIN_OPEN = 0.55;
/** Dragged this far below the smaller size (or flicked down), it closes. */
const CLOSE_DRAG = 90;
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/**
 * A sheet from the bottom that works the same on Android and iOS: opens at 60% of the screen, drag its
 * top (`header`) up to 95% or down to close, or tap the dimmed backdrop, or press Android back. Its
 * content always fills exactly the visible part, so a `footer` (a reply box) sits at the visible
 * bottom, and with the keyboard open the sheet rides above it. Respects reduced motion. `onClose` runs
 * after it has slid away.
 *
 * Given `contentHeight` (how tall the scrolling content is), it fits it: a short thread opens just tall
 * enough (at least 55% of the screen) and isn't pulled up into empty space; a long one opens at 60%
 * and pulls up to 95%. It grows as the content does.
 */
export function BottomSheet({
  header,
  footer,
  children,
  onClose,
  label,
  contentHeight,
  minOpen = MIN_OPEN,
}: {
  header: (close: () => void) => ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  label: string;
  contentHeight?: number;
  /** Smallest opening size, as part of the screen (0 to fit small content exactly, like a preview card). */
  minOpen?: number;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const reduced = useReducedMotion();
  const keyboardHeight = useKeyboardHeight();
  const [chrome, setChrome] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  // Where it rests when opened, and how far it pulls up: the content's height, within the sizes above.
  const fit = contentHeight === undefined || !chrome ? undefined : chrome + contentHeight + footerHeight;
  const restAt = fit === undefined ? screen * DETENTS[0] : Math.min(screen * DETENTS[0], Math.max(screen * minOpen, fit));
  const topAt = fit === undefined ? screen * DETENTS[1] : Math.min(screen * DETENTS[1], Math.max(restAt, fit));
  const rest = useSharedValue(restAt);
  const top = useSharedValue(topAt);
  // How tall the visible part is; 0 is closed.
  const visible = useSharedValue(0);
  const start = useSharedValue(0);

  const go = useCallback(
    (to: number, done?: () => void) => {
      "worklet";
      const finish = (ok?: boolean) => {
        "worklet";
        if (ok && done) runOnJS(done)();
      };
      visible.set(reduced ? withTiming(to, { duration: 0 }, finish) : to === 0 ? withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }, finish) : withSpring(to, SPRING, finish));
    },
    [reduced, visible],
  );
  const close = useCallback(() => go(0, onClose), [go, onClose]);

  // Opens at its resting size, and follows it while the content changes (unless pulled up meanwhile).
  useEffect(() => {
    const wasResting = visible.get() <= rest.get() + 1;
    rest.set(restAt);
    top.set(topAt);
    if (wasResting) go(restAt);
    else if (visible.get() > topAt) go(topAt);
  }, [restAt, topAt, go, rest, top, visible]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // Typing needs room: the keyboard opening pulls the sheet up to its full size.
  useAnimatedReaction(
    () => keyboardHeight.get() > 0,
    (open, was) => {
      if (open && !was && visible.get() > 0 && visible.get() < top.get()) go(top.get());
    },
  );

  const drag = Gesture.Pan()
    .onStart(() => {
      start.set(visible.get());
    })
    .onUpdate((e) => {
      // Past the full size it gives a little, then springs back.
      const want = start.get() - e.translationY;
      visible.set(Math.max(0, want > top.get() ? top.get() + (want - top.get()) * 0.15 : want));
    })
    .onEnd((e) => {
      const at = visible.get();
      const low = rest.get();
      const high = top.get();
      if (at < low - CLOSE_DRAG || (e.velocityY > 1200 && at <= low + 20)) {
        runOnJS(close)();
        return;
      }
      // Flicks go the way they were thrown; otherwise to the nearer size.
      go(e.velocityY < -600 ? high : e.velocityY > 600 ? low : Math.abs(high - at) < Math.abs(low - at) ? high : low);
    });

  const sheet = useAnimatedStyle(() => {
    // With the keyboard up, the sheet sits on it and never goes past the top of the screen.
    const room = screen - keyboardHeight.get() - insets.top - 8;
    return { height: Math.min(visible.get(), room), bottom: keyboardHeight.get() };
  });
  // Above the keyboard there's no home indicator to clear.
  const footerPad = useAnimatedStyle(() => ({ paddingBottom: keyboardHeight.get() > 0 ? 0 : insets.bottom }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(visible.get(), [0, rest.get()], [0, 1], "clamp") }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { backgroundColor: t.colors.background }, sheet]} accessibilityLabel={label}>
        <GestureDetector gesture={drag}>
          <View collapsable={false} onLayout={(e) => setChrome(e.nativeEvent.layout.height)}>
            <View style={styles.grab} accessibilityLabel="Drag to resize" accessibilityHint="Drag up for more, down to close">
              <View style={[styles.handle, { backgroundColor: t.colors.border }]} />
            </View>
            {header(close)}
          </View>
        </GestureDetector>
        <View style={styles.flex}>{children}</View>
        {footer ? (
          <Animated.View style={footerPad} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
            {footer}
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { position: "absolute", left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  grab: { paddingTop: 8, paddingBottom: 4, alignItems: "center" },
  handle: { width: 40, height: 5, borderRadius: 3 },
});
