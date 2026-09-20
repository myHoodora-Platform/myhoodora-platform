import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#147c73",
};

export const metadata: Metadata = {
  title: "myHoodora",
  description:
    "myHoodora connects neighbours to share updates, stay informed, and support local businesses in their community.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.myhoodora.com",
    siteName: "myHoodora",
    title: "myHoodora — Your neighbourhood, connected",
    description:
      "myHoodora connects neighbours to share updates, stay informed, and support local businesses in their community.",
    images: [
      {
        url: "/og/og-teal.png",
        width: 1200,
        height: 630,
        alt: "myHoodora — Your neighbourhood, connected",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "myHoodora — Your neighbourhood, connected",
    description:
      "myHoodora connects neighbours to share updates, stay informed, and support local businesses in their community.",
    images: ["/og/og-teal.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
