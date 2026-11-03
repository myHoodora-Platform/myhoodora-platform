import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy";
import { VersionHistory } from "@/components/legal/version-history";
import { currentLegalVersion, legalVersionLabel } from "@myhoodora/api-contract/legal";

const { version } = currentLegalVersion("privacy");

export const metadata: Metadata = publicPageMetadata("/privacy", {
  title: "Privacy Policy | myHoodora",
  description:
    "Learn how myHoodora collects, uses, and protects your personal information — and how we keep your location private.",
});

export default function Page() {
  return (
    <LegalPage explore={["safety", "guidelines", "about"]}
      title="Privacy Policy"
      updatedAt={legalVersionLabel(version)}
      intro="This policy explains what personal data myHoodora collects on the website and in the app, why, who it's shared with and the rights you have under the Nigeria Data Protection Act 2023."
    >
      <VersionHistory doc="privacy" version={version} />
      <PrivacyPolicyContent />
    </LegalPage>
  );
}
