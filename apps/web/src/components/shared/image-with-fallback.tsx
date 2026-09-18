"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
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
}: ImageWithFallbackProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center",
          className,
        )}
      >
        <ImageOff className="size-5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-500">
          Couldn&apos;t load this image
        </p>
        <p className="text-[11px] text-muted-foreground">
          Make sure the URL points directly to an image file, not a webpage.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {status === "loading" && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg bg-slate-50",
            className,
          )}
        >
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided/uploaded remote URL */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(className, status === "loading" && "opacity-0")}
      />
    </div>
  );
}
