/* eslint-env node */
/**
 * fetch-images.mjs — download + self-host the marketing images locally.
 *
 * Why: the landing pages currently hot-link Wikimedia Commons / Unsplash. The
 * full-res "Aerial view of Lagos Island" file is ~2.3 MB alone, and every page
 * view adds an external network dependency + a remote-host allow-list entry.
 * This script downloads already-optimized sources and re-encodes them to WebP
 * (quality 80) into apps/web/public/images/, so the site can ship compressed,
 * local copies with no third-party runtime dependency.
 *
 * Usage (from the repo root):
 *   node apps/web/scripts/fetch-images.mjs                 # all images
 *   node apps/web/scripts/fetch-images.mjs hero-street ... # only these
 *
 * Requirements: `sharp` (apps/web devDependency). Re-run whenever an entry in
 * the MANIFEST below changes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/images");

/**
 * name -> remote source URL (already-optimized: Unsplash sizing params /
 * Wikimedia 1920px thumbs). Output is written to public/images/<name>.webp.
 */
const MANIFEST = {
  // Hero (landing page) candidates
  "hero-street": {
    url: "https://images.unsplash.com/photo-1648023199223-25d3622bcb13?q=90&w=2560&auto=format&fit=crop",
    credit: "Opeyemi Adisa",
    creditUrl: "https://unsplash.com/@niceyem",
    width: 2560,
    quality: 86,
  },
  "hero-aerial": {
    url: "https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?q=90&w=2560&auto=format&fit=crop",
    credit: "Nupo Deyon Daniel",
    creditUrl: "https://unsplash.com/@thewallpaperguy_",
    width: 2560,
    quality: 86,
  },
  "hero-skyline": {
    url: "https://images.unsplash.com/photo-1559833064-6f4573ec1ac9?q=90&w=2560&auto=format&fit=crop",
    credit: "Stephen Olatunde",
    creditUrl: "https://unsplash.com/@targetfotografi",
    width: 2560,
    quality: 86,
  },
  "hero-traffic": {
    url: "https://images.unsplash.com/photo-1574612357719-5dd0a272afe2?q=80&w=1920&auto=format&fit=crop",
    credit: "Zenith Wogwugwu",
    creditUrl: "https://unsplash.com/@zenithy",
  },
  "hero-market": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/A_Busy_Market_in_Mile_12%2C_Lagos-_Nigeria.jpg/1920px-A_Busy_Market_in_Mile_12%2C_Lagos-_Nigeria.jpg",
    credit: "A Busy Market in Mile 12, Lagos (CC BY-SA 4.0)",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:A_Busy_Market_in_Mile_12,_Lagos-_Nigeria.jpg",
  },

  // Landing "For business" band: busy Lagos market street from above
  "market-street": {
    url: "https://images.unsplash.com/photo-1785094166389-fb5485d11cd3?q=90&w=2400&auto=format&fit=crop",
    credit: "Fahd Aminu",
    creditUrl: "https://unsplash.com/photos/bustling-city-street-scene-with-numerous-vehicles-and-market-activity-RgDIV-QJTI8",
    width: 2400,
    quality: 80,
    // Portrait original: keep a landscape band around the umbrellas + danfos.
    extract: { left: 0, top: 850, width: 2400, height: 1600 },
  },

  // Contact hero background: friends laughing together outdoors
  "contact-people": {
    url: "https://images.unsplash.com/photo-1755705153160-67b29c7718ee?q=90&w=2400&auto=format&fit=crop",
    credit: "Ufoma Ojo",
    creditUrl: "https://unsplash.com/photos/FYq7zbi7iRE",
    width: 2400,
    quality: 82,
  },

  // Careers hero: two colleagues working together in a co-working space
  "careers-team": {
    url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=90&w=1800&auto=format&fit=crop",
    credit: "Unsplash",
    creditUrl: "https://unsplash.com/photos/IgUR1iX0mqM",
    width: 1800,
    quality: 84,
  },

  // Trust & safety candidates
  "trust-hands": {
    url: "https://images.unsplash.com/photo-1524414621493-7dec026782c3?q=80&w=1200&auto=format&fit=crop",
    credit: "John McArthur",
    creditUrl: "https://unsplash.com/@snowjam",
  },
  "trust-neighbors": {
    url: "https://images.unsplash.com/photo-1779357807569-18d3df9df645?q=90&w=1800&auto=format&fit=crop",
    credit: "Random Institute",
    creditUrl: "https://unsplash.com/@randominstitute",
    width: 1800,
    quality: 86,
  },
  "trust-community": {
    url: "https://images.unsplash.com/photo-1553775927-a071d5a6a39a?q=80&w=1200&auto=format&fit=crop",
    credit: "Ninno JackJr",
    creditUrl: "https://unsplash.com/@ninnojackjr",
  },
  "trust-smile": {
    url: "https://images.unsplash.com/photo-1530785602389-07594beb8b73?q=80&w=1200&auto=format&fit=crop",
    credit: "Prince Akachi",
    creditUrl: "https://unsplash.com/@princearkman",
  },
  "trust-current": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/A_smiling_market_woman_at_the_Monday_Market_in_Kakuri%2C_Kaduna_02.jpg/1920px-A_smiling_market_woman_at_the_Monday_Market_in_Kakuri%2C_Kaduna_02.jpg",
    credit: "Kambai Akau (CC BY-SA 4.0)",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:A_smiling_market_woman_at_the_Monday_Market_in_Kakuri,_Kaduna_02.jpg",
  },

  // About-page hero (the ~2.3 MB one we're compressing)
  "about-aerial": {
    url: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Aerial_view_of_Lagos_Island.jpg",
    credit: "Ei'eke (CC BY-SA 4.0)",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Aerial_view_of_Lagos_Island.jpg",
    width: 1600,
    quality: 72,
  },
};

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "myhoodora-image-fetch/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let totalBefore = 0;
  let totalAfter = 0;
  const rows = [];

  const only = process.argv.slice(2);
  const entries = Object.entries(MANIFEST).filter(([name]) => only.length === 0 || only.includes(name));
  for (const [name, entry] of entries) {
    process.stdout.write(`\u2022 ${name} \u2026 `);
    const input = await fetchBuffer(entry.url);
    totalBefore += input.length;

    let pipeline = sharp(input)
      .rotate() // honor EXIF orientation
      .resize({ width: entry.width ?? 1920, withoutEnlargement: true });
    // Optional crop (in resized pixels), e.g. a landscape band from a portrait photo.
    if (entry.extract) pipeline = sharp(await pipeline.toBuffer()).extract(entry.extract);
    const output = await pipeline.webp({ quality: entry.quality ?? 80 }).toBuffer();
    totalAfter += output.length;

    const outPath = path.join(OUT_DIR, `${name}.webp`);
    await writeFile(outPath, output);
    rows.push({ name, before: input.length, after: output.length, credit: entry.credit });
    console.log(`${(input.length / 1024).toFixed(0)} KB -> ${(output.length / 1024).toFixed(0)} KB`);
  }

  console.log("\n===== Summary =====");
  console.log(
    `Downloaded ${rows.length} images: ${(totalBefore / 1024).toFixed(0)} KB -> ${(totalAfter / 1024).toFixed(0)} KB ` +
      `(${((1 - totalAfter / totalBefore) * 100).toFixed(0)}% smaller).`,
  );
  console.log(`Written to: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("\n\u2717", err.message);
  process.exit(1);
});
