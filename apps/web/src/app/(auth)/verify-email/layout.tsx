import type { Metadata } from "next";

/** The token is in the URL: never leak it to other sites via Referer (OWASP). */
export const metadata: Metadata = {
  title: "Confirm your email",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
