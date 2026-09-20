import type { Metadata } from "next";
import { AboutPage } from "@/components/about/about-page";

export const metadata: Metadata = {
  title: "How myHoodora Works",
  description:
    "See how myHoodora works — verify your address, connect with neighbours, and thrive in your local community.",
};

export default function Page() {
  return <AboutPage />;
}
