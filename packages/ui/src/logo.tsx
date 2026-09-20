import React from "react";
import { cn } from "./utils";

export type LogoTone = "fullcolor" | "reversed";
export type LogoLockup = "horizontal" | "stacked";
export type LogoPresetSize = "sm" | "md" | "lg" | "xl";

/** Intrinsic width / height of each asset, taken from its SVG viewBox. */
const RATIO = {
  horizontal: 525.2 / 163.2,
  stacked: 399.2 / 295.88,
  wordmark: 399.2 / 134.6,
  mascotHouse: 394.006 / 235.503,
  mascotWordmark: 1381 / 593.967,
} as const;

const LOCKUP_HEIGHT: Record<LogoPresetSize, number> = {
  sm: 40,
  md: 52,
  lg: 72,
  xl: 104,
};

const MARK_HEIGHT: Record<LogoPresetSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

interface BaseLogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "height" | "width" | "src"> {
  tone?: LogoTone;
  size?: LogoPresetSize | number;
  alt?: string;
  className?: string;
}

export interface LogoFullProps extends BaseLogoProps {
  lockup?: LogoLockup;
}

export type LogoMarkProps = BaseLogoProps;
export type WordmarkProps = BaseLogoProps;
export type MascotMarkProps = BaseLogoProps;
export type MascotWordmarkProps = BaseLogoProps;

function resolveHeight(size: LogoPresetSize | number, presets: Record<LogoPresetSize, number>) {
  return typeof size === "number" ? size : presets[size];
}

function BrandImage({
  src,
  height,
  ratio,
  alt,
  className,
  ...props
}: { src: string; height: number; ratio: number } & BaseLogoProps) {
  const width = Math.round(height * ratio);

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={Math.round(height)}
      style={{ height: `${height}px`, width: "auto" }}
      className={cn("inline-block object-contain shrink-0", className)}
      {...props}
    />
  );
}

/** Primary lockup: badge + wordmark. Use `reversed` on teal, dark or photographic backgrounds. */
export function LogoFull({
  tone = "fullcolor",
  lockup = "horizontal",
  size = "md",
  alt = "myHoodora",
  ...props
}: LogoFullProps) {
  const suffix = tone === "reversed" ? "-reversed" : "";

  return (
    <BrandImage
      src={`/logo/logo-${lockup}${suffix}.svg`}
      height={resolveHeight(size, LOCKUP_HEIGHT)}
      ratio={RATIO[lockup]}
      alt={alt}
      {...props}
    />
  );
}

/** Badge only. Use where the lockup will not fit: collapsed rails, avatars, map pins. */
export function LogoMark({
  tone = "fullcolor",
  size = "md",
  alt = "myHoodora",
  ...props
}: LogoMarkProps) {
  const suffix = tone === "reversed" ? "-reversed" : "";

  return (
    <BrandImage
      src={`/logo/mark${suffix}.svg`}
      height={resolveHeight(size, MARK_HEIGHT)}
      ratio={1}
      alt={alt}
      {...props}
    />
  );
}

/** Wordmark without the badge, for tight headers where the badge would crowd the layout. */
export function Wordmark({
  tone = "fullcolor",
  size = "md",
  alt = "myHoodora",
  ...props
}: WordmarkProps) {
  const suffix = tone === "reversed" ? "-reversed" : "";

  return (
    <BrandImage
      src={`/logo/wordmark${suffix}.svg`}
      height={resolveHeight(size, LOCKUP_HEIGHT)}
      ratio={RATIO.wordmark}
      alt={alt}
      {...props}
    />
  );
}

/** Illustrated house icon (coral roof + teal windows). Use for hero sections, empty states, and onboarding. */
export function MascotMark({
  tone = "fullcolor",
  size = "md",
  alt = "myHoodora",
  ...props
}: MascotMarkProps) {
  const suffix = tone === "reversed" ? "-reversed" : "";

  return (
    <BrandImage
      src={`/logo/mascot-house${suffix}.svg`}
      height={resolveHeight(size, LOCKUP_HEIGHT)}
      ratio={RATIO.mascotHouse}
      alt={alt}
      {...props}
    />
  );
}

/** Wordmark with the roof arc over the "H" — the mascot lockup. Use for splash screens and marketing headers. */
export function MascotWordmark({
  tone = "fullcolor",
  size = "md",
  alt = "myHoodora",
  ...props
}: MascotWordmarkProps) {
  const suffix = tone === "reversed" ? "-reversed" : "";

  return (
    <BrandImage
      src={`/logo/mascot-wordmark${suffix}.svg`}
      height={resolveHeight(size, LOCKUP_HEIGHT)}
      ratio={RATIO.mascotWordmark}
      alt={alt}
      {...props}
    />
  );
}
