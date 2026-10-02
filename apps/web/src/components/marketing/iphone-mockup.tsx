"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@myhoodora/ui/utils";

/**
 * iPhone 18 Pro, drawn to real proportions (Apple product-page style):
 * - body 71.9 × 150 mm; 6.3" display at 402 × 874 points
 * - slim, even bezels; ~20% narrower Dynamic Island than iPhone 17 Pro
 * - buttons where the real device has them: Action + volume (left),
 *   side button + Camera Control (right)
 * The screen content is laid out at the real 402 × 874 point size and
 * scaled to fit, so text and spacing look exactly as on a real phone.
 * Stands upright with a soft floor/contact shadow, no floating drop shadow.
 */

export const SCREEN_POINTS = { width: 402, height: 874 } as const;

const BODY_RATIO = 150 / 71.9; // height / width
const FRAME = 0.012; // metal band thickness, as a fraction of body width
const BEZEL = 0.024; // black glass border around the display

interface IPhoneMockupProps {
  children: React.ReactNode;
  /** Rendered width in px at each size; the device scales from this. */
  className?: string;
  /** Accessible description of what the screen shows. */
  label: string;
  /**
   * Show only the top part of the phone (0–1 of its height), cut off flat at
   * the bottom as if it rises out of a shelf/baseline (Nextdoor Business
   * style). Pair with <PhoneStage> for the baseline. No floor shadow.
   */
  crop?: number;
}

export function IPhoneMockup({ children, className, label, crop }: IPhoneMockupProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frame = width * FRAME;
  const bezel = width * BEZEL;
  const screenWidth = width - 2 * (frame + bezel);
  const scale = screenWidth / SCREEN_POINTS.width;
  const outerRadius = width * 0.178;
  const screenRadius = outerRadius - frame - bezel;

  // Side buttons: [top %, length %] of body height, like the real device.
  const button = (side: "left" | "right", top: number, length: number, flush = false) => (
    <span
      aria-hidden
      className={cn(
        "absolute w-[3px] rounded-full",
        side === "left" ? "-left-[2px]" : "-right-[2px]",
        flush
          ? "bg-gradient-to-b from-zinc-500 to-zinc-700"
          : "bg-gradient-to-b from-[#5b6472] via-[#3a414c] to-[#5b6472]",
      )}
      style={{ top: `${top}%`, height: `${length}%` }}
    />
  );

  return (
    <figure className={cn("relative mx-auto", className)} aria-label={label} role="img">
      {crop ? null : (
        <>
          {/* Floor/contact shadow: the phone stands on a surface. */}
          <div
            aria-hidden
            className="absolute -bottom-3 left-1/2 h-6 w-[78%] -translate-x-1/2 rounded-[100%] bg-foreground/25 blur-xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-1 left-1/2 h-2 w-[58%] -translate-x-1/2 rounded-[100%] bg-foreground/35 blur-md"
          />
        </>
      )}

      {/* Crop window: cuts the device off flat at the bottom when `crop` is
          set. clip-path (not overflow) so the side buttons still show. */}
      <div
        className="relative w-full"
        style={crop ? { aspectRatio: `1 / ${BODY_RATIO * crop}`, minHeight: 0, clipPath: "inset(-8px -8px 0 -8px)" } : undefined}
      >
      <div ref={bodyRef} className="relative w-full" style={{ aspectRatio: `1 / ${BODY_RATIO}` }}>
        {/* Left: Action button, volume up, volume down. Right: side button, Camera Control. */}
        {button("left", 17.5, 4.2)}
        {button("left", 24.5, 7.8)}
        {button("left", 34, 7.8)}
        {button("right", 27, 12)}
        {button("right", 55, 7, true)}

        {/* Metal band (brushed aluminium, Deep Blue finish) */}
        <div
          className="absolute inset-0 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_8px_24px_-12px_rgba(0,0,0,0.35)]"
          style={{
            borderRadius: outerRadius,
            padding: frame,
            background:
              "linear-gradient(145deg, #58637a 0%, #2a3140 22%, #1b212c 50%, #2a3140 78%, #58637a 100%)",
          }}
        >
          {/* Black glass bezel */}
          <div
            className="size-full bg-black"
            style={{ borderRadius: outerRadius - frame, padding: bezel }}
          >
            {/* Display */}
            <div
              className="relative size-full overflow-hidden bg-white"
              style={{ borderRadius: screenRadius }}
            >
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{
                  width: SCREEN_POINTS.width,
                  height: SCREEN_POINTS.height,
                  transform: `scale(${scale})`,
                }}
              >
                {children}
                {/* Dynamic Island (iPhone 18 Pro: narrower) */}
                <div
                  aria-hidden
                  className="absolute top-[11px] left-1/2 z-50 h-[36px] w-[84px] -translate-x-1/2 rounded-full bg-black"
                />
              </div>
              {/* Subtle glass reflection */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_38%)]"
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </figure>
  );
}

/**
 * Soft tinted panel that a cropped phone rises out of, with a thin baseline
 * at the bottom edge — the "phone on a shelf" look from Nextdoor Business.
 */
export function PhoneStage({
  children,
  tone = "primary",
  className,
}: {
  children: React.ReactNode;
  tone?: "primary" | "coral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full max-w-[520px] items-end justify-center overflow-hidden rounded-3xl px-6 pt-12 sm:pt-16",
        tone === "primary" ? "bg-primary/[0.08]" : "bg-brand-coral/[0.09]",
        className,
      )}
    >
      {/* Decorative circle behind the phone */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1/2 size-[78%] -translate-x-1/2 -translate-y-1/3 rounded-full",
          tone === "primary" ? "bg-primary/10" : "bg-brand-coral/10",
        )}
      />
      <div className="relative">{children}</div>
      {/* Baseline the phone stands on */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground/20" />
    </div>
  );
}

/** iOS status bar at 9:41, as in every Apple product shot. */
export function IOSStatusBar({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "#0b0b0c" : "#ffffff";
  return (
    <div className="flex h-[54px] items-center justify-between px-[34px] pt-[6px]" style={{ color }}>
      <span className="w-[80px] text-center text-[17px] font-semibold tracking-tight" style={{ fontFamily: "-apple-system, 'SF Pro Text', Inter, system-ui, sans-serif" }}>
        9:41
      </span>
      <span className="flex w-[80px] items-center justify-center gap-[6px]">
        {/* Cellular */}
        <svg width="19" height="12" viewBox="0 0 19 12" fill={color} aria-hidden>
          <rect x="0" y="8" width="3.2" height="4" rx="1" />
          <rect x="5" y="5.5" width="3.2" height="6.5" rx="1" />
          <rect x="10" y="3" width="3.2" height="9" rx="1" />
          <rect x="15" y="0" width="3.2" height="12" rx="1" />
        </svg>
        {/* Wi-Fi */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill={color} aria-hidden>
          <path d="M8.5 2.6c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8.5.9 10.2 10.2 0 0 0 1.3 3.8L2.5 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.2-1.2a6.9 6.9 0 0 0-9.6 0l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.3c.5 0 1 .2 1.3.5L8.5 11.1 7.2 9.8c.3-.3.8-.5 1.3-.5Z" />
        </svg>
        {/* Battery */}
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke={color} strokeOpacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill={color} />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill={color} fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

/** Home indicator bar at the bottom of the screen. */
export function IOSHomeIndicator() {
  return <div aria-hidden className="absolute bottom-[8px] left-1/2 h-[5px] w-[139px] -translate-x-1/2 rounded-full bg-black/85" />;
}
