"use client";

import { useEffect, useState } from "react";
import { findTourTarget, isPinned, needsScroll } from "./placement";

/** How long to wait for a target that hasn't rendered yet (or vanished) before giving up on the step. */
const MISSING_AFTER_MS = 4000;

export interface TourTarget {
  element: HTMLElement | null;
  rect: DOMRect | null;
  /** Not found within MISSING_AFTER_MS: the step should be skipped. */
  missing: boolean;
}

const EMPTY: TourTarget = { element: null, rect: null, missing: false };

const sameRect = (a: DOMRect | null, b: DOMRect) =>
  !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Finds the element for a tour step and keeps its on-screen box current.
 * Re-resolves on every change rather than holding one element, so it copes
 * with targets that load late, re-render, disappear, or swap at a breakpoint
 * (sidebar ↔ tab bar) when the window is resized or the phone rotated.
 */
export function useTourTarget(id: string | undefined): TourTarget {
  // Tagged with the step it belongs to, so a new step never sees the last one's element.
  const [target, setTarget] = useState<TourTarget & { id?: string }>(EMPTY);

  useEffect(() => {
    if (!id) return;
    let frame = 0;
    let missTimer: ReturnType<typeof setTimeout> | undefined;
    let scrolledTo: HTMLElement | null = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      frame = 0;
      const element = findTourTarget(id);
      if (!element) {
        missTimer ??= setTimeout(() => setTarget({ id, element: null, rect: null, missing: true }), MISSING_AFTER_MS);
        setTarget((prev) => (prev.id === id && !prev.element ? prev : { ...EMPTY, id }));
        return;
      }
      clearTimeout(missTimer);
      missTimer = undefined;

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (element !== scrolledTo) {
        scrolledTo = element;
        if (!isPinned(element) && needsScroll(element.getBoundingClientRect(), viewport)) {
          element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
        }
      }
      const rect = element.getBoundingClientRect();
      setTarget((prev) =>
        prev.id === id && prev.element === element && sameRect(prev.rect, rect) ? prev : { id, element, rect, missing: false },
      );
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };

    schedule();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-tour"] });
    // Content above the target can change height without a DOM mutation (images loading).
    const resizes = new ResizeObserver(schedule);
    resizes.observe(document.body);
    // Capture: also hears scrolling inside containers (e.g. the sidebar, chip rows).
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    // Pinch-zoom and the mobile URL bar resize the visual viewport only.
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(missTimer);
      mutations.disconnect();
      resizes.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [id]);

  return id && target.id === id ? target : EMPTY;
}
