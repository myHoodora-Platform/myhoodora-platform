import type { Metadata } from "next";

/** A utility page: nothing here for search results. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
