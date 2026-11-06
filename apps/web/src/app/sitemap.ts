import type { MetadataRoute } from "next";
import { currentLegalVersion } from "@myhoodora/api-contract/legal";
import { GUIDELINES_UPDATED } from "@/components/legal/community-guidelines";
import { DELETE_ACCOUNT_UPDATED } from "@/components/legal/delete-account";
import { PROVIDERS_UPDATED } from "@/components/legal/providers";
import { SITE_URL } from "@/lib/site";

/**
 * The public pages, and only those: nothing behind sign-in, no auth or utility
 * pages, nothing a neighbour wrote. Each page sets itself as its canonical URL.
 *
 * `lastModified` only where the page's content carries a real date. The
 * marketing pages have none, so they have no lastmod rather than a made-up one
 * (search engines stop trusting a lastmod that changes on every build).
 */
const PAGES: { path: string; lastModified?: string }[] = [
  { path: "/" },
  { path: "/how-it-works" },
  { path: "/about" },
  { path: "/safety" },
  { path: "/business" },
  { path: "/business/get-started" },
  { path: "/ai" },
  { path: "/careers" },
  { path: "/press" },
  { path: "/contact" },
  { path: "/guidelines", lastModified: GUIDELINES_UPDATED },
  { path: "/privacy", lastModified: currentLegalVersion("privacy").version },
  { path: "/privacy/providers", lastModified: PROVIDERS_UPDATED },
  { path: "/terms", lastModified: currentLegalVersion("terms").version },
  { path: "/delete-account", lastModified: DELETE_ACCOUNT_UPDATED },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, lastModified }) => ({ url: `${SITE_URL}${path}`, ...(lastModified && { lastModified }) }));
}
