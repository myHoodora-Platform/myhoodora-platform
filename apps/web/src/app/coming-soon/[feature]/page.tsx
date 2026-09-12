import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon";

function titleize(slug: string) {
  return slug
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
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
  return <ComingSoonPage feature={feature} />;
}
