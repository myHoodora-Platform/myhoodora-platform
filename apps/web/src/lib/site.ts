import type { Metadata } from "next";

/**
 * The site's public origin, for absolute URLs in metadata, the sitemap and
 * robots.txt. Set NEXT_PUBLIC_APP_URL in each deployment (e.g.
 * https://www.myhoodora.com); without it, links fall back to localhost.
 */
/**
 * Where to write (docs/compliance/ndpa.md §6). Privacy and data requests have their own address, and
 * the Data Protection Officer theirs (NDPA s.27, s.32), as Nextdoor does with privacy@ and dpo@.
 * Both mailboxes must exist before a release that shows them.
 */
export const CONTACT_EMAIL = "hello@myhoodora.com";
export const PRIVACY_EMAIL = "privacy@myhoodora.com";
export const DPO_EMAIL = "dpo@myhoodora.com";
/** Must match the DPO named on the NDPC registration (Form 2, step 4). */
export const DPO_NAME = "Peace Arakunle";

/**
 * The company behind myHoodora, as on its CAC registration and D-U-N-S certificate (Dun & Bradstreet
 * Nigeria, valid to 28 October 2027). Google Play shows the same name and address on the store listing.
 */
export const COMPANY = {
  legalName: "MYHOODORA LIMITED",
  rcNumber: "9546341",
  dunsNumber: "321520963",
  address: "4 Amusa Idowu Street, off Community Road, Ijegun, Ikotun, Lagos State, Nigeria",
} as const;

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
