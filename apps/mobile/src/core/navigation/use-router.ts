// The one place allowed to use expo-router's own hook (eslint.config.js points everyone else here).
// eslint-disable-next-line no-restricted-imports
import { useRouter as useExpoRouter } from "expo-router";
import { useMemo } from "react";

/** Long enough to cover a double tap and the screen's open animation; short enough not to be noticed. */
export const NAV_LOCK_MS = 600;

let lockedUntil = 0;

/** True the first time, false for any further opens within the lock: one screen per tap, however fast. */
export function claimNavigation(now = Date.now()): boolean {
  if (now < lockedUntil) return false;
  lockedUntil = now + NAV_LOCK_MS;
  return true;
}

/** For tests. */
export function resetNavigationLock() {
  lockedUntil = 0;
}

/**
 * expo-router's router, but a quick double (or triple) tap opens a screen once. Without this, each tap
 * pushed its own copy and Back had to be pressed once per tap. The lock is app-wide: two different rows
 * tapped together also open only the first. Back and dismiss are never held up.
 */
type Router = ReturnType<typeof useExpoRouter>;

export function useRouter(): Router {
  const router = useExpoRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => void (claimNavigation() && router.push(href, options)),
      navigate: (href, options) => void (claimNavigation() && router.navigate(href, options)),
      replace: (href, options) => void (claimNavigation() && router.replace(href, options)),
    }),
    [router],
  );
}
