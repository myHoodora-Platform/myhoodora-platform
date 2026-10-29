import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

/**
 * How much of the screen the keyboard covers, in points, following it as it slides. One source for
 * every screen, sheet and modal: a modal is its own window on Android, which Reanimated's
 * useAnimatedKeyboard can't see (a form in a sheet stayed under the keyboard); keyboard-controller
 * follows the keyboard there too. Needs the app's KeyboardProvider (app/_layout.tsx).
 */
export function useKeyboardHeight(): SharedValue<number> {
  const { height } = useReanimatedKeyboardAnimation();
  // keyboard-controller reports it as a translation: negative while open.
  return useDerivedValue(() => Math.max(0, -height.get()));
}
