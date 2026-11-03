import { useEffect, useRef, useState } from "react";
import type { LiveEvent } from "./live-events";
import { useLiveEvent } from "./live-bus";

/** Matches the API's window (TYPING_SIGNAL_MS): at most one signal per 2.5 s. */
export const SIGNAL_EVERY_MS = 2_500;
/** Hide "typing…" this long after the last signal (they paused or left). */
export const SHOW_FOR_MS = 5_000;

/**
 * Tells the other side you're typing while `draft` changes: at most one request per window, none for
 * an empty box. Failures are ignored (it's a nicety, never worth an error). Same as the web.
 */
export function useTypingSignal(draft: string, send: () => Promise<void>): void {
  const lastSent = useRef(0);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (!draft.trim()) return;
    const now = Date.now();
    if (now - lastSent.current < SIGNAL_EVERY_MS) return;
    lastSent.current = now;
    void sendRef.current().catch(() => undefined);
  }, [draft]);
}

/**
 * true while the other side is typing: set by `typingType` events that `match`, cleared SHOW_FOR_MS
 * after the last one, or at once when one of `clearTypes` (their message arriving) matches.
 */
export function useTypingIndicator(typingType: string, clearTypes: readonly string[], match: (e: LiveEvent) => boolean): boolean {
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const matchRef = useRef(match);
  useEffect(() => {
    matchRef.current = match;
  });

  useLiveEvent(typingType, (e) => {
    if (!matchRef.current(e)) return;
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTyping(false), SHOW_FOR_MS);
  });
  useLiveEvent(clearTypes, (e) => {
    if (!matchRef.current(e)) return;
    clearTimeout(timer.current);
    setTyping(false);
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  return typing;
}
