import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages, and only those: nothing behind sign-in belongs in a sitemap. */
const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/safety", priority: 0.7, changeFrequency: "monthly" },
  { path: "/business", priority: 0.7, changeFrequency: "monthly" },
  { path: "/business/get-started", priority: 0.5, changeFrequency: "monthly" },
  { path: "/ai", priority: 0.4, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.4, changeFrequency: "monthly" },
  { path: "/press", priority: 0.4, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/guidelines", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/register", priority: 0.6, changeFrequency: "yearly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority, changeFrequency }) => ({ url: `${SITE_URL}${path}`, changeFrequency, priority }));
}
