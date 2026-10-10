"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, onThemeChange } from "@/lib/theme";

/**
 * Keeps <html>'s theme right after the first paint (which the boot script in
 * the root layout handles): when the route changes between themed and
 * light-only pages, when the choice changes in Settings or another tab, and
 * when the device switches between light and dark.
 */
export function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    applyTheme(pathname);
    return onThemeChange(() => applyTheme(pathname));
  }, [pathname]);
  return null;
}

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the page is currently dark, for third-party widgets that take a theme prop (toasts, emoji picker). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}
