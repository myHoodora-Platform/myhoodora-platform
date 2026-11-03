import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type APIRequestContext } from "@playwright/test";

/** Run with playwright.seo.config.ts (pnpm test:e2e:seo), which says what the site's origin is. */
const ORIGIN = process.env.E2E_SEO_ORIGIN!;
const SCHEMA = fileURLToPath(new URL("./fixtures/sitemap-0.9.xsd", import.meta.url));
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Nothing behind sign-in, no auth or utility pages, nothing a neighbour wrote, no query strings. */
const NEVER_LISTED = [
  /\/(login|register|forgot-password|reset-password|verify-email|onboarding|accept-terms|confirm-age|welcome-back)(\/|$)/,
  /\/(admin|api|dashboard|news-feed|alerts|events|for-sale|groups|g|p|inbox|notifications|profile|search|settings|leads|help)(\/|$)/,
  /\/coming-soon(\/|$)/,
  /\/versions\//,
  /\/business\/claim/,
  /[?#]/,
];

/** W3C Datetime (https://www.w3.org/TR/NOTE-datetime), the format sitemaps.org requires for lastmod. */
const W3C_DATETIME = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))].map((m) => m[1]!);
}

/** A sitemap URL, fetched from the server under test (the same path on a local build). */
function onServer(loc: string): string {
  return new URL(loc).pathname;
}

async function getSitemap(request: APIRequestContext) {
  const response = await request.get("/sitemap.xml");
  return { response, xml: await response.text() };
}

test("robots.txt lets crawlers in, keeps them off the API and names the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const robots = await response.text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  // Pages kept out with noindex must stay fetchable, or crawlers never see the noindex.
  expect(robots.match(/^Disallow:.*$/gm)).toEqual(["Disallow: /api/"]);
  expect(robots).not.toMatch(/^Host:/im);
});

test("the sitemap is valid XML in the sitemaps.org 0.9 format", async ({ request }) => {
  const { response, xml } = await getSitemap(request);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^application\/xml\b/);
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  expect(xml).not.toMatch(/<(priority|changefreq)>/);

  const file = join(mkdtempSync(join(tmpdir(), "sitemap-")), "sitemap.xml");
  writeFileSync(file, xml);
  // xmllint exits non-zero, with the reason, if the file doesn't match the schema.
  execFileSync("xmllint", ["--noout", "--schema", SCHEMA, file], { stdio: "pipe" });
});

test("the sitemap lists only public pages, as absolute https URLs on the production origin", async ({ request }) => {
  const locs = tags((await getSitemap(request)).xml, "loc");
  expect(locs.length).toBeGreaterThan(0);
  expect(new Set(locs).size).toBe(locs.length);
  for (const loc of locs) {
    expect(loc.startsWith(`${ORIGIN}/`), loc).toBe(true);
    expect(new URL(loc).protocol, loc).toBe("https:");
    for (const pattern of NEVER_LISTED) expect(new URL(loc).pathname + new URL(loc).search, loc).not.toMatch(pattern);
  }
});

test("lastmod values are real W3C dates, not the build or request time", async ({ request }) => {
  const now = Date.now();
  for (const lastmod of tags((await getSitemap(request)).xml, "lastmod")) {
    expect(lastmod).toMatch(W3C_DATETIME);
    const time = Date.parse(lastmod);
    expect(Number.isNaN(time), lastmod).toBe(false);
    expect(time, `${lastmod} is in the future`).toBeLessThanOrEqual(now);
    // A time of day within the last day would be a timestamp from the build, not the content.
    if (lastmod.includes("T")) expect(now - time, lastmod).toBeGreaterThan(24 * 60 * 60 * 1000);
  }
});

test("every page in the sitemap answers 200 itself, is its own canonical URL and isn't noindexed", async ({ request }) => {
  const locs = tags((await getSitemap(request)).xml, "loc");
  for (const loc of locs) {
    const response = await request.get(onServer(loc), { maxRedirects: 0, headers: { "User-Agent": GOOGLEBOT } });
    expect(response.status(), `${loc} should answer 200 without a redirect`).toBe(200);
    expect(response.headers()["x-robots-tag"] ?? "", loc).not.toMatch(/noindex/i);

    const html = await response.text();
    const canonicals = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*>/g)].map((m) => m[0].match(/href="([^"]*)"/)?.[1]);
    expect(canonicals, `${loc} should have one canonical link`).toHaveLength(1);
    expect(new URL(canonicals[0]!).href, loc).toBe(new URL(loc).href);
    for (const meta of html.matchAll(/<meta[^>]*name="(robots|googlebot)"[^>]*>/g)) expect(meta[0], loc).not.toMatch(/noindex/i);
  }
});

test("utility pages are noindexed, and the search page needs a sign-in", async ({ request }) => {
  for (const path of ["/forgot-password", "/reset-password"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  }
  // Signed out, /search never renders (the signed-in app's layout noindexes it as well).
  const search = await request.get("/search?q=anything", { maxRedirects: 0 });
  expect(search.status()).toBe(307);
  expect(search.headers()["location"]).toMatch(/^\/login\?next=/);
});

test("only known coming-soon pages exist", async ({ request }) => {
  expect((await request.get("/coming-soon/marketplace")).status()).toBe(200);
  expect((await request.get("/coming-soon/anything-at-all")).status()).toBe(404);
});

test("the production site's *.vercel.app address is noindexed, the real domain isn't", async ({ request }) => {
  test.skip(!!process.env.E2E_SEO_BASE_URL, "Needs a server that answers for any Host header");
  const onVercel = await request.get("/about", { headers: { Host: "myhoodora.vercel.app" } });
  expect(onVercel.headers()["x-robots-tag"]).toBe("noindex");
  expect((await request.get("/about")).headers()["x-robots-tag"]).toBeUndefined();
});
