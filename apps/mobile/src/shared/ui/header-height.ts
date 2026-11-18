import { useSyncExternalStore } from "react";

/**
 * The height of the fixed header on screen (FixedHeader reports it), for decorations that hang from its
 * foot, like the festive lights. 0 until a header has measured itself.
 */
let height = 0;
const listeners = new Set<() => void>();

export function reportHeaderHeight(next: number): void {
  if (next === height) return;
  height = next;
  for (const listener of listeners) listener();
}

export function useFixedHeaderHeight(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => height,
  );
}
