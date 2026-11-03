import type { ComponentProps } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

/**
 * The scroll view for any screen with fields to fill in: whichever field is being typed in scrolls
 * above the keyboard, however far down the form it is, on Android (drawn edge to edge, where the
 * window never shrinks for the keyboard) and iOS alike. Use it instead of a plain ScrollView for forms.
 */
export function FormScrollView({ bottomOffset = 24, keyboardShouldPersistTaps = "handled", ...rest }: ComponentProps<typeof KeyboardAwareScrollView>) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...rest} />;
}
