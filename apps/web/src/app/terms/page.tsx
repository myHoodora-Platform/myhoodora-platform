import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { LegalPage } from "@/components/legal/legal-page";
import { TermsContent } from "@/components/legal/terms";

export const metadata: Metadata = publicPageMetadata("/terms", {
  title: "Terms of Use | myHoodora",
  description: "The terms for using myHoodora, the neighbourhood network for Nigeria.",
});

export default function Page() {
  return (
    <LegalPage explore={["safety", "guidelines", "about"]}
      title="Terms of Use"
      updatedAt="28 September 2026"
      intro="Plain-English terms for using myHoodora. Please read them together with our Community Guidelines and Privacy Policy."
    >
      <TermsContent />
    </LegalPage>
  );
}
