const isDev = process.env.NODE_ENV !== "production";

/** scheme + host of a URL from the environment, or nothing if it isn't set (or isn't a URL). */
function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api");
const firebaseAuthOrigin = `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "myhoodora-e9ba5.firebaseapp.com"}`;

/**
 * Content-Security-Policy: what this site may load and talk to. Everything
 * not listed is refused by the browser, so adding a third-party service
 * means adding it here (docs/security.md has the list and the reasons).
 *
 * script-src keeps 'unsafe-inline' because Next.js bootstraps pages with
 * inline scripts; the stricter alternative (a per-request nonce) would turn
 * every static page into a server-rendered one. External scripts are still
 * limited to Google's two sign-in loaders.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Google Identity Services (One Tap) and the Google API loader Firebase's sign-in pop-up uses.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client https://apis.google.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  // Neighbours can paste a photo link from any https site; uploads come from Cloudinary.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Our API, Firebase Auth, Google sign-in, map tiles, and Cloudinary (direct video uploads, when enabled).
  `connect-src 'self' ${apiOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com/gsi/ https://tiles.openfreemap.org https://api.cloudinary.com${isDev ? " ws:" : ""}`,
  // Firebase's sign-in helper frame and Google's One Tap frame.
  `frame-src ${firebaseAuthOrigin} https://accounts.google.com/gsi/`,
  // The map renders in a web worker created from a blob.
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 90 is used for full-bleed hero photos so they stay crisp on large screens.
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Uploaded photos (contract §20: the API's storage layer, Cloudinary today).
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Without this, Google's own sign-in page sets a stricter
          // Cross-Origin-Opener-Policy that blocks Firebase's popup-closed
          // detection, so signInWithPopup()'s promise only settles via a slow
          // fallback instead of resolving/rejecting promptly.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Browsers ignore this over plain HTTP, so it is safe to send everywhere.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Older browsers that don't read frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Location is used by onboarding ("Use my current location"); nothing needs the rest.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
