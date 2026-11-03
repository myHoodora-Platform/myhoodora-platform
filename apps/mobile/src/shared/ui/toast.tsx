import { CircleCheck, CircleAlert } from "lucide-react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/shared/hooks/use-reduced-motion";
import { useTheme } from "@/shared/theme/theme";
import { Text } from "./text";

type Tone = "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | undefined>(undefined);
const SHOW_MS = 3500;

/**
 * A short confirmation at the top of the screen ("New link sent"), gone by itself. Never the only place
 * an error lives when the person must act on it: those stay on the screen. Read out by screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, tone: Tone = "success") => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, tone }));
    AccessibilityInfo.announceForAccessibility(message);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [y] = useState(() => new Animated.Value(-20));
  const [opacity] = useState(() => new Animated.Value(0));

  // Slides in; with reduced motion it simply appears.
  useEffect(() => {
    const duration = reduced ? 0 : 200;
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [reduced, y, opacity]);

  useEffect(() => {
    const timer = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  const Icon = toast.tone === "success" ? CircleCheck : CircleAlert;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={[styles.toast, { backgroundColor: t.colors.foreground, opacity, transform: [{ translateY: y }] }]}>
        <Icon size={18} color={toast.tone === "success" ? "#4ade80" : "#f87171"} />
        <Text variant="label" style={[styles.text, { color: t.colors.background }]}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 480, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  text: { flexShrink: 1 },
});
