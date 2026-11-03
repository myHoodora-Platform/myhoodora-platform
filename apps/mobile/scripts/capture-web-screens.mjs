// Captures the web's iPhone mockups (the same ones the marketing pages show) for the intro screens.
// Needs the web app running on :3000 and Playwright's Chromium (`pnpm --filter web exec playwright install chromium`).
// Run from the repository root: node apps/mobile/scripts/capture-web-screens.mjs "$PWD"
// Then: node apps/mobile/scripts/make-assets.cjs "$PWD"
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [repo] = process.argv.slice(2);
const { chromium } = createRequire(path.join(repo, "apps/web/package.json"))("@playwright/test");
const out = path.join(repo, "apps/mobile/assets/screens/raw");
mkdirSync(out, { recursive: true });

/** [page, the mockup's aria-label, file name] */
const SHOTS = [
  ["/", "The myHoodora app on an iPhone, showing active alerts and posts from neighbours in Lekki Phase 1", "feed"],
  ["/business", "Neighbours recommending Femi Electricals in a thread", "recommendation"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3, reducedMotion: "reduce" });
for (const [route, label, name] of SHOTS) {
  await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
  const phone = page.locator(`figure[role="img"][aria-label="${label}"]`);
  await phone.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await phone.screenshot({ path: path.join(out, `${name}.png`), omitBackground: true, animations: "disabled" });
  console.log(`captured ${name}.png`);
}
await browser.close();
