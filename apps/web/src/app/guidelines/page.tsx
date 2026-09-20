import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { CommunityGuidelinesContent } from "@/components/legal/community-guidelines";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "The guidelines that keep myHoodora neighbourhoods welcoming, safe, and useful for everyone.",
};

export default function Page() {
  return (
    <LegalPage
      title="Community Guidelines"
      updatedAt="August 2026"
      intro="Hi neighbour. We're glad you're here. We all play a part in making myHoodora a welcoming, safe place for everyone. These guidelines help every neighbourhood feel at home — please follow them, and help us by reporting anything that breaks them."
    >
      <CommunityGuidelinesContent />
    </LegalPage>
  );
}
