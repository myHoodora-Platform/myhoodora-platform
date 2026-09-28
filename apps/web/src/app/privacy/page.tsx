import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how myHoodora collects, uses, and protects your personal information — and how we keep your location private.",
};

export default function Page() {
  return (
    <LegalPage explore={["safety", "guidelines", "about"]}
      title="Privacy Policy"
      updatedAt="28 September 2026"
      intro="This policy explains what personal data myHoodora collects, why, who it's shared with and the rights you have under the Nigeria Data Protection Act 2023. The short version: we only use your address to place you in your neighbourhood, we never show it to anyone, and we never sell your data."
    >
      <PrivacyPolicyContent />
    </LegalPage>
  );
}
