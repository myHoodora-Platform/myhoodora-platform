"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  /** Sizing for the wrapper, e.g. "absolute inset-0" inside a fixed-size tile. */
  wrapperClassName?: string;
  srcSet?: string;
  sizes?: string;
  style?: React.CSSProperties;
  /** Called with the loaded element (natural size, for smart framing). */
  onLoaded?: (img: HTMLImageElement) => void;
  /** Shown instead of the explanatory error box when the image can't load (small tiles have no room for it). */
  errorFallback?: React.ReactNode;
}

/**
 * Renders src with an explicit loading/error state instead of leaving a
 * silent broken-image icon — a page URL (e.g. an Unsplash photo page rather
 * than its direct image file) fails to load as an <img>, and without this
 * the failure was invisible.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  srcSet,
  sizes,
  style,
  onLoaded,
  errorFallback,
}: ImageWithFallbackProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  if (status === "error" && errorFallback !== undefined) return <>{errorFallback}</>;

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted p-6 text-center",
          className,
          wrapperClassName,
        )}
      >
        <ImageOff className="size-5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">
          Couldn&apos;t load this image
        </p>
        <p className="text-[11px] text-muted-foreground">
          Make sure the URL points directly to an image file, not a webpage.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative", wrapperClassName)}>
      {status === "loading" && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg bg-muted",
            className,
          )}
        >
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided/uploaded remote URL */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        style={style}
        decoding="async"
        onLoad={(e) => {
          setStatus("loaded");
          onLoaded?.(e.currentTarget);
        }}
        onError={() => setStatus("error")}
        className={cn(className, status === "loading" && "opacity-0")}
      />
    </div>
  );
}
