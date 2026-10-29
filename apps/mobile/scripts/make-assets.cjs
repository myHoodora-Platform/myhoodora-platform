// Renders the mobile app's brand images from the logos the web shows (apps/web/public/logo, used
// through packages/ui/src/logo.tsx): the mascot house (coral roof, four-pane window), the mascot
// wordmark, and the mascot lockup.
// Run from the repository root: node apps/mobile/scripts/make-assets.cjs "$PWD"
// Uses the web app's sharp (a dev dependency there), so run `pnpm install` first.
const { Buffer } = require("buffer");
const fs = require("fs");
const path = require("path");
const [repo] = process.argv.slice(2);
const sharp = require(path.join(repo, "apps/web/node_modules/sharp"));
const logo = (name) => path.join(repo, "apps/web/public/logo", name);
const brand = path.join(repo, "apps/mobile/assets/brand");
fs.mkdirSync(brand, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** An SVG (or raster) rendered `width` px wide, centred on a `size` square canvas. */
async function centred(file, width, size, background, recolour) {
  let input = file;
  if (file.endsWith(".svg")) {
    let svg = fs.readFileSync(file, "utf8");
    if (recolour) svg = svg.replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${recolour}"`);
    input = Buffer.from(svg);
  }
  const art = await sharp(input, { density: 1200 }).resize({ width }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } }).composite([{ input: art, gravity: "center" }]).png();
}

/** An SVG as a PNG `width` px wide (in-app images; three times their on-screen width). */
const png = (file, width) => sharp(fs.readFileSync(file), { density: 1200 }).resize({ width }).png();

(async () => {
  const jobs = [
    // App icon (iOS, store): the mascot lockup (the web's sign-in art), on white, as large as the icon mask allows.
    ["images/icon.png", (await centred(logo("mascot-lockup-1024.webp"), 900, 1024, WHITE)).flatten({ background: "#ffffff" })],
    // Android adaptive icon: the lockup inside the central safe zone; the white background is set in app.config.ts.
    ["images/android-icon-foreground.png", await centred(logo("mascot-lockup-1024.webp"), 640, 1024, CLEAR)],
    // Android 13 themed icon: one colour, tinted by the system. The illustration can't be one colour; the roof can.
    ["images/android-icon-monochrome.png", await centred(logo("mascot-house.svg"), 600, 1024, CLEAR, "#FFFFFF")],
    // Splash: the mascot lockup on white.
    ["images/splash-icon.png", await centred(logo("mascot-lockup-1024.webp"), 1024, 1024, CLEAR)],
    // In the app: header wordmark (shown ~120 pt wide) and the sign-in lockup.
    ["brand/mascot-wordmark.png", png(logo("mascot-wordmark.svg"), 480)],
    // The roof on its own: the large faded shape on the first intro slide, and a badge.
    ["brand/mascot-house.png", png(logo("mascot-house.svg"), 900)],
    ["brand/mascot-wordmark-reversed.png", png(logo("mascot-wordmark-reversed.svg"), 480)],
  ];
  for (const [name, img] of jobs) {
    await img.toFile(path.join(repo, "apps/mobile/assets", name));
    console.log("wrote", name);
  }
  // The lockup is raster art; the web serves these same files.
  for (const w of [320, 640]) fs.copyFileSync(logo(`mascot-lockup-${w}.webp`), path.join(brand, `mascot-lockup-${w}.webp`));
  console.log("copied brand/mascot-lockup-{320,640}.webp");

  // Intro and sign-in photography: the web's own photos (apps/web/public/images), sized for phones.
  const photos = path.join(repo, "apps/mobile/assets/photos");
  fs.mkdirSync(photos, { recursive: true });
  const PHOTOS = { welcome: "hero-street", login: "contact-people", register: "hero-skyline", reset: "hero-aerial", neighbour: "trust-smile" };
  for (const [name, source] of Object.entries(PHOTOS)) {
    await sharp(path.join(repo, "apps/web/public/images", `${source}.webp`)).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(photos, `${name}.webp`));
    console.log(`wrote photos/${name}.webp (from ${source}.webp)`);
  }

  // The web's app mockups, captured by capture-web-screens.mjs into assets/screens/raw (see that file).
  const screens = path.join(repo, "apps/mobile/assets/screens");
  for (const name of ["feed", "recommendation"]) {
    const raw = path.join(screens, "raw", `${name}.png`);
    if (!fs.existsSync(raw)) continue;
    await sharp(raw).resize({ width: 720 }).webp({ quality: 85 }).toFile(path.join(screens, `${name}.webp`));
    console.log(`wrote screens/${name}.webp`);
  }
})();
