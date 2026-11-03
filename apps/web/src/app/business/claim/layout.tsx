import type { Metadata } from "next";

/** The claim token is in the URL: don't leak it through Referer. */
export const metadata: Metadata = {
  title: "Claim your Business Page | myHoodora",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
