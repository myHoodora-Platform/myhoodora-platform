import type { Metadata } from "next";

/**
 * The site's public origin, for absolute URLs in metadata, the sitemap and
 * robots.txt. Set NEXT_PUBLIC_APP_URL in each deployment (e.g.
 * https://www.myhoodora.com); without it, links fall back to localhost.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Metadata for a public page: its own title and description in search results
 * *and* in link previews (WhatsApp, X, Facebook…), with the page as its own
 * canonical URL. Without this a page inherits the home page's preview text.
 * The preview image and site name come from the root layout.
 */
export function publicPageMetadata(path: string, { title, description }: { title: string; description: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "myHoodora",
      locale: "en_NG",
      url: path,
      title,
      description,
      images: [{ url: "/og/og-teal.png", width: 1200, height: 630, alt: "myHoodora — Your neighbourhood, connected" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og/og-teal.png"] },
  };
}
