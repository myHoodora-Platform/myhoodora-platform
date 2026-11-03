import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** iOS "Reduce Transparency": glass becomes solid, as the system's own bars do. */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((on) => alive && setReduced(on));
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
