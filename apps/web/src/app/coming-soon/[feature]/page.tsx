import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/coming-soon";
import { COMING_SOON_FEATURES, isComingSoonFeature } from "@/lib/coming-soon";

function titleize(slug: string) {
  return slug
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function generateStaticParams() {
  return COMING_SOON_FEATURES.map((feature) => ({ feature }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
  if (!isComingSoonFeature(feature)) notFound();
  const title = titleize(feature);
  return {
    title: `${title} — Coming Soon | myHoodora`,
    description: `${title} is on its way at myHoodora. Leave your email to be first to know.`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  // Checked here, not with dynamicParams = false, so it keeps working if Cache Components is turned on.
  if (!isComingSoonFeature(feature)) notFound();
  return <ComingSoonPage feature={feature} />;
}
