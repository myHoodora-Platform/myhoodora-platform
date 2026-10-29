import { PixelRatio } from "react-native";

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
/** Widths we ask for, so the CDN serves a few cached sizes rather than one per phone. */
const STEPS = [240, 480, 720, 1080, 1440];

/**
 * A Cloudinary photo at the size it's shown (in device pixels, rounded up to a step), in the best
 * format the phone takes. Full-size uploads are several MB; on mobile data that's most of a page.
 * Anything not on Cloudinary, or already transformed, is returned as it is.
 */
export function sizedImage(url: string, widthPoints: number, scale = PixelRatio.get()): string {
  const m = CLOUDINARY_UPLOAD.exec(url);
  if (!m) return url;
  const [, base, rest] = m;
  // An existing transformation (e.g. "c_fill,w_200/") comes before the version or public id.
  if (/^[a-z]{1,3}_[^/]*\//.test(rest!)) return url;
  const px = Math.ceil(widthPoints * scale);
  const width = STEPS.find((s) => s >= px) ?? STEPS[STEPS.length - 1]!;
  return `${base}c_limit,w_${width},q_auto,f_auto/${rest}`;
}
