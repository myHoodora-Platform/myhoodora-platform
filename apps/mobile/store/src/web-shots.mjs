// Screenshots of the public website from the local dev server (http://localhost:3000), for marketing.
// Run from apps/web: node ../mobile/store/src/web-shots.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { chromium } = createRequire(path.join(process.cwd(), "package.json"))("@playwright/test");
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../web");
const pages = [["home", "/"], ["how-it-works", "/how-it-works"], ["safety", "/safety"]];
const sizes = [["desktop", { width: 1440, height: 900 }, 1], ["phone", { width: 390, height: 844 }, 3]];

const browser = await chromium.launch();
for (const [size, viewport, scale] of sizes) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: "light", isMobile: size === "phone" });
  const page = await context.newPage();
  for (const [name, route] of pages) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // The dev-only Next.js badge and any Google One Tap prompt don't belong in a marketing shot.
    await page.addStyleTag({ content: "nextjs-portal, #credential_picker_container, iframe[src*='accounts.google'] { display: none !important; }" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `${name}-${size}.png`) });
    console.log(`${name}-${size}.png`);
  }
  await context.close();
}
await browser.close();
