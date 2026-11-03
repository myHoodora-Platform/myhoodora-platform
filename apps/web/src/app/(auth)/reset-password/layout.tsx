import type { Metadata } from "next";

/** Only ever opened from a reset email, with a one-time code in the URL: never a search result. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
