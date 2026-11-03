/** The features with a "coming soon" page. Any other /coming-soon/<slug> is a 404, not a page with a made-up title. */
export const COMING_SOON_FEATURES = [
  "careers",
  "press",
  "contact",
  "verification",
  "safety-center",
  "business-pages",
  "api",
  "marketplace",
  "for-business",
] as const;

export type ComingSoonFeature = (typeof COMING_SOON_FEATURES)[number];

export function isComingSoonFeature(slug: string): slug is ComingSoonFeature {
  return (COMING_SOON_FEATURES as readonly string[]).includes(slug);
}
