import React from "react";
import { cn } from "./utils";

export type LogoVariant = "transparent" | "white-bg";
export type LogoPresetSize = "sm" | "md" | "lg" | "xl";

export interface LogoMarkProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
  size?: LogoPresetSize | number;
  alt?: string;
  className?: string;
  src?: string;
}

export interface LogoFullProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
  size?: LogoPresetSize | number;
  alt?: string;
  className?: string;
  src?: string;
}

export interface LogoProps extends LogoFullProps {
  markOnly?: boolean;
}

const MARK_SIZE_MAP: Record<LogoPresetSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

const FULL_SIZE_MAP: Record<LogoPresetSize, { width: number; height: number }> = {
  sm: { width: 120, height: 28 },
  md: { width: 160, height: 38 },
  lg: { width: 220, height: 52 },
  xl: { width: 320, height: 76 },
};

function getFullLogoSrc(variant: LogoVariant, size: LogoPresetSize | number): string {
  const isWhite = variant === "white-bg";
  const prefix = isWhite ? "/logo/myhoodora-logo-white-bg" : "/logo/myhoodora-logo-transparent";

  if (typeof size === "number") {
    if (size <= 200) return `${prefix}-200w.png`;
    if (size <= 400) return `${prefix}-400w.png`;
    if (size <= 800) return `${prefix}-800w.png`;
    return `${prefix}.png`;
  }

  switch (size) {
    case "sm":
    case "md":
      return `${prefix}-200w.png`;
    case "lg":
      return `${prefix}-400w.png`;
    case "xl":
      return `${prefix}-800w.png`;
    default:
      return `${prefix}.png`;
  }
}

export function LogoMark({
  variant = "transparent",
  size = "md",
  alt = "myHoodora",
  className = "",
  src,
  ...props
}: LogoMarkProps) {
  const pixelSize = typeof size === "number" ? size : MARK_SIZE_MAP[size] || MARK_SIZE_MAP.md;
  const imageSrc = src || (variant === "white-bg" ? "/favicon/apple-touch-icon.png" : "/favicon/icon-192.png");

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      className={cn(
        "inline-block object-contain shrink-0",
        variant === "white-bg" && "bg-white rounded-lg p-0.5 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function LogoFull({
  variant = "transparent",
  size = "md",
  alt = "myHoodora",
  className = "",
  src,
  ...props
}: LogoFullProps) {
  const dimensions =
    typeof size === "number"
      ? { width: size, height: Math.round(size * 0.24) }
      : FULL_SIZE_MAP[size] || FULL_SIZE_MAP.md;

  const imageSrc = src || getFullLogoSrc(variant, size);

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      style={{ width: `${dimensions.width}px`, height: "auto" }}
      className={cn("inline-block object-contain shrink-0", className)}
      {...props}
    />
  );
}

export function Logo({
  markOnly = false,
  variant = "transparent",
  size = "md",
  alt = "myHoodora",
  className = "",
  ...props
}: LogoProps) {
  if (markOnly) {
    return <LogoMark variant={variant} size={size} alt={alt} className={className} {...props} />;
  }

  return <LogoFull variant={variant} size={size} alt={alt} className={className} {...props} />;
}
