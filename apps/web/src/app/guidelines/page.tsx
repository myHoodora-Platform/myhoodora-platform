import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { LegalPage } from "@/components/legal/legal-page";
import { CommunityGuidelinesContent, GUIDELINES_UPDATED } from "@/components/legal/community-guidelines";
import { legalVersionLabel } from "@myhoodora/api-contract/legal";

export const metadata: Metadata = publicPageMetadata("/guidelines", {
  title: "Community Guidelines",
  description:
    "The guidelines that keep myHoodora neighbourhoods welcoming, safe, and useful for everyone.",
});

export default function Page() {
  return (
    <LegalPage explore={["safety", "how-it-works", "about"]}
      title="Community Guidelines"
      updatedAt={legalVersionLabel(GUIDELINES_UPDATED)}
      intro="Hi neighbour, we're glad you're here. myHoodora works because neighbours treat each other well. These guidelines apply everywhere on myHoodora: the feed, alerts, comments, groups, listings and messages. Please follow them, and report anything that breaks them."
    >
      <CommunityGuidelinesContent />
    </LegalPage>
  );
}
