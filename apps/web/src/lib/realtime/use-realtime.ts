"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMockChanges } from "@/hooks/use-mock-changes";
import { useRealtimeRegistry } from "./realtime-provider";
import type { RealtimeEvent, RealtimeEventType } from "./types";

type Types = RealtimeEventType | readonly RealtimeEventType[];
const list = (t: Types): RealtimeEventType[] => (typeof t === "string" ? [t] : [...t]);

/** Run `handler` for each live event of these types. */
export function useRealtime(types: Types, handler: (e: RealtimeEvent) => void): void {
  const registry = useRealtimeRegistry();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const key = list(types).join(",");
  useEffect(() => {
    if (!registry) return;
    return registry.subscribe(key.split(",") as RealtimeEventType[], (e) => handlerRef.current(e));
  }, [registry, key]);
}

/** Run `handler` after a reconnect (or fallback poll): refetch what may have been missed. */
export function useRealtimeResync(handler: () => void): void {
  const registry = useRealtimeRegistry();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!registry) return;
    return registry.onResync(() => handlerRef.current());
  }, [registry]);
}

/**
 * A counter to put in an effect's dependencies: it changes whenever one of
 * these events arrives, after a reconnect, and on preview-store changes.
 * The simplest way to make a screen live: "refetch when this changes".
 * Pass `filter` to ignore events about other things (another thread, post…).
 */
export function useLiveVersion(types: Types, options: { mockPrefix?: string; filter?: (e: RealtimeEvent) => boolean } = {}): number {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const filterRef = useRef(options.filter);
  useEffect(() => {
    filterRef.current = options.filter;
  });
  useRealtime(types, (e) => {
    if (!filterRef.current || filterRef.current(e)) bump();
  });
  useRealtimeResync(bump);
  const mock = useMockChanges(options.mockPrefix);
  // Both only ever increase, so the sum changes whenever either does.
  return version + mock;
}
