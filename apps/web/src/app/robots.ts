import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { isIndexable } from "@/lib/site-env";

/**
 * Production: crawl everything but the API. Nothing else is blocked here on
 * purpose. The signed-in app, admin and auth utility pages are kept out of
 * results by sign-in and noindex instead, and a crawler can only see a noindex
 * on a page it may fetch. Listing them would also map the app for anyone
 * reading this file.
 *
 * Previews, staging and local builds: nothing (see site-env.js).
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
