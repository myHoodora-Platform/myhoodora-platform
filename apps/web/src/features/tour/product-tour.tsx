"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@myhoodora/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@myhoodora/ui/popover";
import { cn } from "@myhoodora/ui/utils";
import { preferredSide } from "./placement";
import { useTourTarget } from "./use-tour-target";

export interface TourStep {
  /** Matches a `data-tour` attribute on the element to highlight. */
  target: string;
  title: string;
  body: string;
}

export type TourEnd = "completed" | "skipped";

/** Breathing room between the target's edge and the spotlight outline. */
const SPOTLIGHT_PAD = 6;
// Same dim as the app's dialogs and sheets (bg-foreground/40), as a shadow so the target stays undimmed.
const DIM = "color-mix(in srgb, var(--foreground) 40%, transparent)";
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Coach-mark tour: dims the page, spotlights one element per step and shows a
 * small card beside it. Optional at every point (Skip, Escape). Steps whose
 * element never shows up are passed over, so a missing target can't strand
 * the user. The page underneath is inert while it runs; the card keeps focus.
 */
export function ProductTour({ steps, label, onEnd }: { steps: TourStep[]; label: string; onEnd: (how: TourEnd) => void }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const { element, rect, missing } = useTourTarget(step?.target);
  const isLast = index === steps.length - 1;
  const titleId = useId();
  const bodyId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const next = () => (isLast ? onEnd("completed") : setIndex((i) => i + 1));

  // A target that never appeared: move on (or finish) rather than hang on a dimmed screen.
  useEffect(() => {
    if (!missing) return;
    if (isLast) onEnd("completed");
    else setIndex((i) => i + 1);
  }, [missing, isLast, onEnd]);

  // Each new step: put focus on its main action so Enter/Space continues
  // (onOpenAutoFocus covers the card's first mount, after the portal attaches).
  const shown = !!element;
  useEffect(() => {
    if (shown) nextRef.current?.focus({ preventScroll: true });
  }, [index, shown]);

  const anchor = useMemo(() => ({ current: element }), [element]);
  const side = rect ? preferredSide(rect, { width: window.innerWidth, height: window.innerHeight }) : "bottom";

  // Focus stays inside the card while the page behind is inert. Inside it,
  // Radix's looping focus scope already wraps Tab; this only catches focus
  // that slipped out (a click on the overlay, the card remounting between
  // steps) and pulls it back in on the next Tab.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const card = cardRef.current;
      if (e.key !== "Tab" || !card || card.contains(document.activeElement)) return;
      const focusable = card.querySelectorAll<HTMLElement>("button:not([disabled])");
      const to = e.shiftKey ? focusable[focusable.length - 1] : focusable[0];
      if (!to) return;
      e.preventDefault();
      to.focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  if (!step) return null;

  return (
    <>
      {/* Blocks clicks on the page underneath; wheel/touch scrolling still reaches it. */}
      <div aria-hidden className="fixed inset-0 z-[60]" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed z-[60] rounded-2xl motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-safe:ease-out",
          rect && "ring-2 ring-primary/70",
        )}
        style={
          rect
            ? {
                top: rect.top - SPOTLIGHT_PAD,
                left: rect.left - SPOTLIGHT_PAD,
                width: rect.width + SPOTLIGHT_PAD * 2,
                height: rect.height + SPOTLIGHT_PAD * 2,
                boxShadow: `0 0 0 200vmax ${DIM}`,
              }
            : // Waiting for the target: plain dim, no hole.
              { inset: 0, background: DIM }
        }
      />

      <Popover open={shown} onOpenChange={(open) => !open && onEnd("skipped")}>
        <PopoverAnchor virtualRef={anchor} />
        <PopoverContent
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          side={side}
          align="center"
          sideOffset={SPOTLIGHT_PAD + 10}
          collisionPadding={12}
          // Clicks and focus outside don't dismiss; Escape does (→ onOpenChange → skipped).
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nextRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[61] w-[min(20rem,calc(100vw-1.5rem))] p-4 motion-reduce:animate-none"
        >
          <p className="text-xs font-semibold text-primary" aria-live="polite">
            <span className="sr-only">{label}, step </span>
            {index + 1} of {steps.length}
          </p>
          <h2 id={titleId} className="mt-1 text-base font-bold text-foreground">
            {step.title}
          </h2>
          <p id={bodyId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2">
            {isLast ? (
              <span />
            ) : (
              <Button variant="ghost" size="sm" className={cn("px-3 text-muted-foreground", focusRing)} onClick={() => onEnd("skipped")}>
                Skip tour
              </Button>
            )}
            <Button ref={nextRef} size="sm" className={cn("min-h-10 shadow-none", focusRing)} onClick={next}>
              {isLast ? "Get started" : "Next"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
