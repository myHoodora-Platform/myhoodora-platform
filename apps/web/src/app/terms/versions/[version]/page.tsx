import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { legalVersionLabel } from "@myhoodora/api-contract/legal";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_ARCHIVE } from "@/components/legal/archive";
import { VersionHistory } from "@/components/legal/version-history";

/** An earlier Terms of Use, word for word as published (docs/compliance/legal-versions.md). */
export function generateStaticParams() {
  return Object.keys(LEGAL_ARCHIVE.terms).map((version) => ({ version }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ version: string }> }): Promise<Metadata> {
  const { version } = await params;
  // Kept for the record, not for search results.
  return { title: `Terms of Use, ${legalVersionLabel(version)} | myHoodora`, robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const Content = LEGAL_ARCHIVE.terms[version];
  if (!Content) notFound();
  return (
    <LegalPage explore={["safety", "guidelines", "about"]} title="Terms of Use" updatedAt={legalVersionLabel(version)}>
      <VersionHistory doc="terms" version={version} />
      <Content />
    </LegalPage>
  );
}
