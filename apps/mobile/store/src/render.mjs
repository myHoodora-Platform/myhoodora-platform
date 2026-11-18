// Renders the store graphics in this folder to PNG with the repository's Playwright Chromium.
// Run from apps/web (where Playwright is installed): node ../mobile/store/src/render.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Playwright lives in apps/web, so resolve it from the working directory, not from this file.
const { chromium } = createRequire(path.join(process.cwd(), "package.json"))("@playwright/test");

const here = path.dirname(fileURLToPath(import.meta.url));
const jobs = [
  { page: "feature-graphic.html", out: "../feature-graphic.png", width: 1024, height: 500 },
  // App Store creative assets: PNG with the alpha channel removed afterwards (Apple refuses any).
  { page: "app-store-header.html", out: "../app-store-header.png", width: 3840, height: 1646, opaque: true },
  { page: "app-store-header-photo.html", out: "../app-store-header-photo.png", width: 3840, height: 1646, opaque: true },
  { page: "app-store-search.html", out: "../app-store-search.png", width: 3840, height: 2560, opaque: true },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(here, job.page)}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(here, job.out), omitBackground: false });
  // Chromium's PNGs carry an alpha channel even when nothing is transparent: drop it (macOS sips via JPEG would
  // lose quality, so flatten through BMP, which has no alpha).
  if (job.opaque) {
    const { execFileSync } = await import("node:child_process");
    const out = path.join(here, job.out), bmp = out.replace(/\.png$/, ".bmp");
    execFileSync("sips", ["-s", "format", "bmp", out, "--out", bmp]);
    execFileSync("sips", ["-s", "format", "png", bmp, "--out", out]);
    execFileSync("rm", [bmp]);
  }
  await page.close();
  console.log(`${job.out} ${job.width}×${job.height}`);
}
await browser.close();
