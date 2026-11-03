"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL, USE_MOCKS } from "@/lib/api/config";
import { createSseSource } from "./sse-source";
import type { RealtimeEvent, RealtimeEventType, RealtimeStatus } from "./types";

/** After this many failed reconnects in a row, also poll so nothing goes stale. */
const FALLBACK_AFTER_ATTEMPTS = 3;
const FALLBACK_POLL_MS = 15_000;
/** Close the stream when the tab has been in the background this long. */
const HIDDEN_PAUSE_MS = 5 * 60_000;

type Listener = (e: RealtimeEvent) => void;

export interface RealtimeRegistry {
  subscribe(types: RealtimeEventType[], fn: Listener): () => void;
  /** Called after a reconnect (and on fallback polls): refetch what may have been missed. */
  onResync(fn: () => void): () => void;
}

const RegistryCtx = createContext<RealtimeRegistry | null>(null);
const StatusCtx = createContext<RealtimeStatus>("idle");

/**
 * One live connection for the whole app (mounted next to AuthProvider).
 * Screens subscribe through useRealtime / useLiveVersion; none of them know
 * about the transport. Preview (mock) mode stays on the mock store's own
 * change events, so this stays idle there.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const listeners = useRef(new Map<RealtimeEventType, Set<Listener>>());
  const resyncs = useRef(new Set<() => void>());
  // The very first open needs no resync; every later one might have missed events.
  const resyncOnOpen = useRef(false);

  const registry = useMemo<RealtimeRegistry>(
    () => ({
      subscribe(types, fn) {
        for (const t of types) {
          if (!listeners.current.has(t)) listeners.current.set(t, new Set());
          listeners.current.get(t)!.add(fn);
        }
        return () => types.forEach((t) => listeners.current.get(t)?.delete(fn));
      },
      onResync(fn) {
        resyncs.current.add(fn);
        return () => resyncs.current.delete(fn);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!user || USE_MOCKS || paused) {
      setStatus("idle");
      return;
    }
    const resyncAll = () =>
      resyncs.current.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.error("Realtime resync handler failed:", err);
        }
      });
    let fallback: ReturnType<typeof setInterval> | undefined;
    setStatus("connecting");
    const source = createSseSource(`${API_BASE_URL}/realtime/stream`, () => user.getIdToken());
    const close = source.connect({
      onOpen: () => {
        setStatus("live");
        clearInterval(fallback);
        fallback = undefined;
        if (resyncOnOpen.current) resyncAll();
        resyncOnOpen.current = true;
      },
      onEvent: (e) => {
        if (e.type === "session.changed") {
          // Hood, role or account state changed: new channels, fresh profile.
          void refreshProfile();
          setEpoch((n) => n + 1);
        }
        listeners.current.get(e.type)?.forEach((fn) => fn(e));
      },
      onDrop: (attempt) => {
        const offline = attempt >= FALLBACK_AFTER_ATTEMPTS;
        setStatus(offline ? "offline" : "reconnecting");
        if (offline && !fallback) fallback = setInterval(resyncAll, FALLBACK_POLL_MS);
      },
    });
    return () => {
      close();
      clearInterval(fallback);
    };
  }, [user, epoch, paused, refreshProfile]);

  // Back online: reconnect now instead of waiting out the backoff.
  useEffect(() => {
    const onOnline = () => setEpoch((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Don't hold a connection for a tab nobody's looking at.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") timer = setTimeout(() => setPaused(true), HIDDEN_PAUSE_MS);
      else setPaused(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <RegistryCtx.Provider value={registry}>
      <StatusCtx.Provider value={status}>{children}</StatusCtx.Provider>
    </RegistryCtx.Provider>
  );
}

export function useRealtimeRegistry(): RealtimeRegistry | null {
  return useContext(RegistryCtx);
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(StatusCtx);
}
