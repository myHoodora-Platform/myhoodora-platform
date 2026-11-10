import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { LegalPage } from "@/components/legal/legal-page";
import { CHILD_SAFETY_UPDATED } from "@/components/legal/child-safety";
import { ChildSafetyContent } from "@/components/legal/child-safety-content";
import { legalVersionLabel } from "@myhoodora/api-contract/legal";

export const metadata: Metadata = publicPageMetadata("/child-safety", {
  title: "myHoodora Child Safety Standards",
  description: "myHoodora's standards against child sexual abuse and exploitation, how to report a concern, and what we do about it.",
});

export default function Page() {
  return (
    <LegalPage explore={["safety", "how-it-works", "about"]}
      title="myHoodora Child Safety Standards"
      updatedAt={legalVersionLabel(CHILD_SAFETY_UPDATED)}
      intro="myHoodora is a neighbourhood network for adults. Keeping children safe is everyone's job, and we take it seriously: here is what we don't allow, how to report a concern, and what we do about it."
    >
      <ChildSafetyContent />
    </LegalPage>
  );
}
