/**
 * The service providers that handle personal data for us: the public list at /privacy/providers,
 * which the privacy policy points to instead of naming them (the sub-processor list pattern). Keep it
 * in step with docs/compliance/ndpa.md §3: a new vendor, or a vendor moving region, is a change here
 * and to PROVIDERS_UPDATED.
 *
 * `where: null` means we haven't confirmed the region yet. The page says so; fill it in before launch.
 */
export interface Provider {
  name: string;
  /** What they do for us. */
  role: string;
  /** The personal data they handle. */
  data: string;
  /** Where they store or process it, or null until confirmed. */
  where: string | null;
  /** What protects it there (NDPA s.41–43). */
  safeguard: string;
}

/** When this list last changed, "YYYY-MM-DD": shown on the page and used as its sitemap lastmod. */
export const PROVIDERS_UPDATED = "2026-11-02";

export const PROVIDERS: Provider[] = [
  {
    name: "Google Firebase",
    role: "Sign-in",
    data: "Email address, password (scrambled, never readable), Google or Apple sign-in ID",
    where: "United States",
    safeguard: "Google Cloud data processing terms, with standard contractual clauses",
  },
  {
    name: "MongoDB Atlas",
    role: "Our database",
    data: "Your account, address, neighbourhood and everything you post or send",
    where: null,
    safeguard: "MongoDB data processing agreement, with standard contractual clauses",
  },
  {
    name: "Cloudinary",
    role: "Photos, videos and files",
    data: "Photos, videos and PDFs you upload",
    where: "United States",
    safeguard: "Cloudinary data processing addendum",
  },
  {
    name: "Render",
    role: "Runs our API (the servers the app and website talk to)",
    data: "Everything sent to myHoodora, including your IP address",
    where: null,
    safeguard: "Render data processing addendum",
  },
  {
    name: "Vercel",
    role: "Runs our website",
    data: "Pages you visit and your IP address",
    where: "United States, with public pages cached worldwide",
    safeguard: "Vercel data processing addendum",
  },
  {
    name: "Upstash",
    role: "Live updates and rate limits",
    data: "Short-lived account IDs and IP addresses, kept for minutes to hours",
    where: null,
    safeguard: "Upstash data processing agreement",
  },
  {
    name: "Resend",
    role: "Sending our emails",
    data: "Your email address and the email we send you",
    where: "United States",
    safeguard: "Resend data processing agreement",
  },
  {
    name: "Expo",
    role: "Push notifications",
    data: "Your phone's push token and the notification text",
    where: "United States",
    safeguard: "Expo terms of service and privacy policy",
  },
  {
    name: "Apple and Google",
    role: "Delivering push notifications to iPhones and Android phones",
    data: "Your phone's push token and the notification text",
    where: "Worldwide, on Apple's and Google's own networks",
    safeguard: "Apple and Google developer terms",
  },
  {
    name: "Sentry",
    role: "Crash reports from the mobile app",
    data: "Your account ID and what the app was doing when it crashed. Never your name, email, messages or screenshots",
    where: "United States",
    safeguard: "Sentry data processing addendum",
  },
  {
    name: "OpenFreeMap",
    role: "Map pictures",
    data: "The map area being shown, and your IP address",
    where: null,
    safeguard: "No account data is sent",
  },
  {
    name: "maps.co",
    role: "Address lookup",
    data: "The address you type, or the point on the map you choose",
    where: null,
    safeguard: "Only the address is sent, never who typed it",
  },
  {
    name: "ip-api.com",
    role: "Guessing your general area during sign-up, when our host can't",
    data: "Your IP address",
    where: null,
    safeguard: "Only the IP address is sent, never who you are",
  },
];
