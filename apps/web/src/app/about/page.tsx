import type { Metadata } from "next";
import { AboutPage } from "@/components/about/about-page";

export const metadata: Metadata = {
  title: "About myHoodora",
  description:
    "Learn how myHoodora connects neighbors to share updates, stay safe, and build stronger, friendlier communities.",
};

export default function Page() {
  return <AboutPage />;
}
