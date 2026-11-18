import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = join(process.cwd(), "assets/fonts/outfit");
const WEIGHTS = [
  [400, "Regular"],
  [600, "SemiBold"],
  [700, "Bold"],
  [800, "ExtraBold"],
] as const;

/**
 * The brand font for `next/og` images. Without it the renderer has one regular-weight face, so bold
 * headlines came out regular. Read per render (small files; the routes are cached by the CDN).
 */
export async function ogFonts() {
  return Promise.all(
    WEIGHTS.map(async ([weight, name]) => ({ name: "Outfit", data: await readFile(join(DIR, `Outfit_${weight}${name}.ttf`)), weight, style: "normal" as const })),
  );
}
