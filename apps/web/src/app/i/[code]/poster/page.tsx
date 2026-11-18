import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PosterSheet } from "@/features/invites/invite-poster";
import { posterQr } from "@/features/invites/poster-qr";
import { getPublicInvite } from "@/lib/api/invites";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Invite poster | myHoodora", robots: { index: false, follow: false } };

/**
 * A neighbour's printable QR poster, public like their invite page (/i/<code>) and showing no more: their
 * first name and Hood. The app opens it in the phone's browser to print or save as PDF.
 */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = await getPublicInvite(code);
  if (res.status === "missing") notFound();
  if (res.status !== "ok") return <p className="mx-auto max-w-xl p-6 text-sm text-muted-foreground">The poster couldn&apos;t be made just now. Try again in a minute.</p>;
  const link = `${SITE_URL}/i/${res.invite.code}`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PosterSheet code={res.invite.code} name={res.invite.inviter.firstName} hood={res.invite.hood?.name} svg={await posterQr(link)} link={link} />
    </main>
  );
}
