/**
 * Which deployment this is, as far as search engines are concerned: only
 * production is indexed. Plain JS so next.config.js can share it with the app.
 *
 * SITE_ENV says so explicitly on any host. On Vercel, VERCEL_ENV
 * ("production" | "preview" | "development") says so without any setup.
 * Anything else, a local build included, is kept out of search results.
 * Both are read on the server at build time (robots.txt and the headers are
 * built then), so a preview build stays a preview build.
 */

/** @param {Record<string, string | undefined>} [env] */
export function siteEnv(env = process.env) {
  return env.SITE_ENV || env.VERCEL_ENV || "development";
}

/** @param {Record<string, string | undefined>} [env] */
export function isIndexable(env = process.env) {
  return siteEnv(env) === "production";
}

/**
 * Why NEXT_PUBLIC_APP_URL can't be a production site's origin, or null if it can.
 * It is inlined at build time, so a wrong value ends up in every canonical URL,
 * link preview and sitemap entry until the next build.
 * @param {string | undefined} value
 * @returns {string | null}
 */
export function appUrlProblem(value) {
  if (!value) return "NEXT_PUBLIC_APP_URL is not set";
  let url;
  try {
    url = new URL(value);
  } catch {
    return `NEXT_PUBLIC_APP_URL is not a URL: ${value}`;
  }
  if (url.protocol !== "https:") return `NEXT_PUBLIC_APP_URL must be https: ${value}`;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return `NEXT_PUBLIC_APP_URL points at this machine: ${value}`;
  return null;
}
