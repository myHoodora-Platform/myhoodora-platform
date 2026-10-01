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
        // Without this, Google's own sign-in page sets a stricter
        // Cross-Origin-Opener-Policy that blocks Firebase's popup-closed
        // detection, so signInWithPopup()'s promise only settles via a slow
        // fallback instead of resolving/rejecting promptly.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
