import Image, { type ImageProps } from "next/image";

export interface SmartImageProps
  extends Omit<ImageProps, "alt" | "unoptimized" | "loading" | "sizes"> {
  alt: string;
  loading?: "lazy" | "eager";
  sizes?: string;
}

/**
 * Reusable, optimized image component.
 *
 * Wraps `next/image` with sensible defaults: lazy loading (eager when
 * `priority`), a required `alt`, and a `100vw` fallback for full-bleed
 * (`fill`) images. It relies on Next.js's image optimizer, so remote hosts
 * must be allow-listed via `images.remotePatterns` in `next.config`.
 */
export function SmartImage({
  alt,
  loading = "lazy",
  sizes,
  fill,
  priority,
  ...props
}: SmartImageProps) {
  return (
    <Image
      alt={alt}
      loading={priority ? "eager" : loading}
      priority={priority}
      fill={fill}
      sizes={sizes ?? (fill ? "100vw" : undefined)}
      {...props}
    />
  );
}
