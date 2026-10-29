import { useEffect, useRef } from "react";
import type { LiveEvent } from "./live-events";

type Listener = (e: LiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();

/**
 * Live events for the screens that react to them directly (typing indicators), alongside what
 * applyLiveEvent refreshes for everyone. The live connection emits every event here.
 */
export const liveBus = {
  emit(e: LiveEvent): void {
    listeners.get(e.type)?.forEach((fn) => fn(e));
  },
  on(type: string, fn: Listener): () => void {
    let set = listeners.get(type);
    if (!set) listeners.set(type, (set = new Set()));
    set.add(fn);
    return () => {
      set.delete(fn);
      if (!set.size) listeners.delete(type);
    };
  },
};

/** Runs `handler` for each live event of these types while the component is mounted. */
export function useLiveEvent(types: string | readonly string[], handler: Listener): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const key = typeof types === "string" ? types : types.join(",");
  useEffect(() => {
    const offs = key.split(",").map((type) => liveBus.on(type, (e) => handlerRef.current(e)));
    return () => offs.forEach((off) => off());
  }, [key]);
}
