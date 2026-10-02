/**
 * Delivery helpers for uploaded media, like a Next.js image loader: ask the
 * CDN for exactly the size and crop a spot needs. Cloudinary URLs (contract
 * §20) get resize + smart crop (`g_auto` keeps faces and subjects in frame);
 * any other URL (pasted, Google photo) passes through unchanged. A new
 * storage provider only needs a branch here.
 */

const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)([^?#]*)(.*)$/;
/** A transformation segment ("f_auto,q_auto", "w_480,c_fill"): has key_value pairs, isn't a version ("v1"). */
const TRANSFORM_SEGMENT = /^(?!v\d+$)[a-z]{1,3}_[^/]*$/;

/** Feed photos stay between 1.91:1 (landscape) and 4:5 (portrait), like Instagram and Facebook. */
export const FEED_ASPECT = { min: 4 / 5, max: 1.91 } as const;
export const clampAspect = (ratio: number) => Math.min(FEED_ASPECT.max, Math.max(FEED_ASPECT.min, ratio));

export interface ImageOptions {
  /** CSS pixels wide; the CDN never upscales. */
  width: number;
  /** width / height. Set → fill that box with a smart crop; unset → keep the photo's own shape. */
  aspect?: number;
}

function cloudinaryParts(url: string) {
  const m = CLOUDINARY.exec(url);
  if (!m) return null;
  const segments = m[2]!.split("/");
  while (segments.length > 1 && TRANSFORM_SEGMENT.test(segments[0]!)) segments.shift();
  return { base: m[1]!, path: segments.join("/"), query: m[3] ?? "" };
}

export function isCloudinaryUrl(url: string): boolean {
  return CLOUDINARY.test(url);
}

/** A sized (and, with `aspect`, smart-cropped) image URL. */
export function imageUrl(url: string, { width, aspect }: ImageOptions): string {
  const parts = cloudinaryParts(url);
  if (!parts) return url;
  const t = ["f_auto", "q_auto", `w_${Math.round(width)}`, aspect ? `c_fill,g_auto,ar_${aspect.toFixed(3)}` : "c_limit"];
  return `${parts.base}${t.join(",")}/${parts.path}${parts.query}`;
}

/** `srcset` for responsive images (1× and 2× screens on phones and desktops). */
export function imageSrcSet(url: string, opts: Omit<ImageOptions, "width">, widths = [360, 540, 720, 1080, 1440]): string | undefined {
  if (!isCloudinaryUrl(url)) return undefined;
  return widths.map((w) => `${imageUrl(url, { ...opts, width: w })} ${w}w`).join(", ");
}

/** Videos we deliver end in .mp4/.mov/.webm (the API's storage layer guarantees it for uploads). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(url) || /res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(url);
}

/** A still frame to show before a video plays (Cloudinary); undefined → the browser shows the first frame. */
export function videoPoster(url: string, width = 720): string | undefined {
  const parts = cloudinaryParts(url);
  if (!parts) return undefined;
  const path = parts.path.replace(/\.(mp4|mov|webm|m4v)$/i, "") + ".jpg";
  return `${parts.base}so_0,f_auto,q_auto,w_${width},c_limit/${path}${parts.query}`;
}
