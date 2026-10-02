"use client";

import { Toaster } from "sonner";
import { useIsDark } from "./theme-sync";

/**
 * Toasts slide down from the top-centre, just under the app header (so they
 * never cover the bell/messages icons), then slide back up. Every toast has
 * a close button, pauses while hovered, can be swiped away, and clears in
 * ~4s. Only 3 stack at once.
 */
export function AppToaster() {
  const dark = useIsDark();
  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
      duration={4000}
      visibleToasts={3}
      // Desktop header is 72px, phone header 64px (+ notch on iOS).
      offset={{ top: 84 }}
      mobileOffset={{ top: "calc(72px + env(safe-area-inset-top))", left: 12, right: 12 }}
      toastOptions={{ className: "font-sans" }}
    />
  );
}
