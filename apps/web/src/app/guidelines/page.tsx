import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { LegalPage } from "@/components/legal/legal-page";
import { CommunityGuidelinesContent } from "@/components/legal/community-guidelines";

export const metadata: Metadata = publicPageMetadata("/guidelines", {
  title: "Community Guidelines",
  description:
    "The guidelines that keep myHoodora neighbourhoods welcoming, safe, and useful for everyone.",
});

export default function Page() {
  return (
    <LegalPage explore={["safety", "how-it-works", "about"]}
      title="Community Guidelines"
      updatedAt="28 September 2026"
      intro="Hi neighbour, we're glad you're here. myHoodora works because neighbours treat each other well. These guidelines apply everywhere on myHoodora: the feed, alerts, comments, groups, listings and messages. Please follow them, and report anything that breaks them."
    >
      <CommunityGuidelinesContent />
    </LegalPage>
  );
}
