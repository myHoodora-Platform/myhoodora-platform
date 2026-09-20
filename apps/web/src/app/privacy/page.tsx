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
    <LegalPage
      title="Privacy Policy"
      updatedAt="August 2026"
      intro="This Privacy Policy explains how myHoodora collects, uses, and protects your information. We are built for neighbourhoods — and we take your privacy, especially your location, seriously."
    >
      <PrivacyPolicyContent />
    </LegalPage>
  );
}
