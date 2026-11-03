import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIDELINES_UPDATED } from "@/components/legal/community-guidelines";
import { PROVIDERS_UPDATED } from "@/components/legal/providers";

const ORIGIN = "https://www.myhoodora.com";

/** The modules read the environment when imported (SITE_URL) or called (isIndexable). */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Whatever the machine running the tests has set.
  vi.stubEnv("SITE_ENV", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return {
    robots: (await import("./robots")).default,
    sitemap: (await import("./sitemap")).default,
    nextConfig: (await import("../../next.config.js")).default,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("sitemap", () => {
  it("lists exactly the public pages, as absolute URLs on the site's origin", async () => {
    const { sitemap } = await load({ NEXT_PUBLIC_APP_URL: ORIGIN });
    expect(sitemap().map((entry) => entry.url)).toEqual(
      [
        "/",
        "/how-it-works",
        "/about",
        "/safety",
        "/business",
        "/business/get-started",
        "/ai",
        "/careers",
        "/press",
        "/contact",
        "/guidelines",
        "/privacy",
        "/privacy/providers",
        "/terms",
      ].map((path) => `${ORIGIN}${path}`),
    );
  });

  it("has no priority or changefreq, and a lastmod only where the content has a date", async () => {
    const { sitemap } = await load({ NEXT_PUBLIC_APP_URL: ORIGIN });
    const entries = sitemap();
    for (const entry of entries) expect(Object.keys(entry).sort()).toEqual(entry.lastModified ? ["lastModified", "url"] : ["url"]);
    const lastmod = Object.fromEntries(entries.filter((e) => e.lastModified).map((e) => [e.url.slice(ORIGIN.length), e.lastModified]));
    expect(lastmod).toEqual({
      "/guidelines": GUIDELINES_UPDATED,
      "/privacy": expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "/privacy/providers": PROVIDERS_UPDATED,
      "/terms": expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});

describe("robots.txt", () => {
  it("in production: everything but the API, and the sitemap", async () => {
    const { robots } = await load({ NEXT_PUBLIC_APP_URL: ORIGIN, VERCEL_ENV: "production" });
    expect(robots()).toEqual({ rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }], sitemap: `${ORIGIN}/sitemap.xml` });
  });

  it.each([{ VERCEL_ENV: "preview" }, { SITE_ENV: "staging" }, {}])("anywhere else (%j): nothing", async (env) => {
    const { robots } = await load({ NEXT_PUBLIC_APP_URL: ORIGIN, ...env });
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});

describe("next.config", () => {
  async function robotsHeaders(env: Record<string, string | undefined>) {
    const { nextConfig } = await load({ NEXT_PUBLIC_APP_URL: ORIGIN, ...env });
    const headers = await nextConfig(PHASE_DEVELOPMENT_SERVER).headers!();
    return headers.filter((rule) => rule.headers.some((h) => h.key === "X-Robots-Tag"));
  }

  it("in production, noindexes only the *.vercel.app address", async () => {
    expect(await robotsHeaders({ VERCEL_ENV: "production" })).toEqual([
      { source: "/:path*", has: [{ type: "host", value: ".*\\.vercel\\.app" }], headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ]);
  });

  it("elsewhere, noindexes every host Vercel doesn't already cover", async () => {
    expect(await robotsHeaders({ VERCEL_ENV: "preview" })).toEqual([
      { source: "/:path*", missing: [{ type: "host", value: ".*\\.vercel\\.app" }], headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ]);
  });

  it.each([undefined, "http://www.myhoodora.com", "http://localhost:3000"])("refuses a production build with NEXT_PUBLIC_APP_URL=%j", async (url) => {
    const { nextConfig } = await load({ SITE_ENV: "production", NEXT_PUBLIC_APP_URL: url });
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("builds production with an https origin, and previews or dev servers with anything", async () => {
    expect((await load({ SITE_ENV: "production", NEXT_PUBLIC_APP_URL: ORIGIN })).nextConfig(PHASE_PRODUCTION_BUILD)).toBeTruthy();
    expect((await load({ VERCEL_ENV: "preview", NEXT_PUBLIC_APP_URL: undefined })).nextConfig(PHASE_PRODUCTION_BUILD)).toBeTruthy();
    expect((await load({ SITE_ENV: "production", NEXT_PUBLIC_APP_URL: undefined })).nextConfig(PHASE_DEVELOPMENT_SERVER)).toBeTruthy();
  });
});
