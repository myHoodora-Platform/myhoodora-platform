import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Only the marketing and legal pages are for search engines. Everything a
 * neighbour sees after signing in is private to their Hood (and behind the
 * proxy anyway), so crawlers are told not to try.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/onboarding",
          "/news-feed",
          "/alerts",
          "/events",
          "/for-sale",
          "/groups",
          "/g/",
          "/p/",
          "/inbox",
          "/notifications",
          "/profile/",
          "/search",
          "/settings",
          "/leads",
          "/help",
          "/dashboard",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/business/claim",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
