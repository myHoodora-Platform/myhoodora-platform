import type { Metadata } from "next";
import { badgeLabel } from "@myhoodora/api-contract/engagement";
import { InviteLanding } from "@/features/invites/invite-landing";
import { getPublicInvite } from "@/lib/api/invites";

/**
 * A shared badge, myhoodora.com/i/<code>/badge ("Share my badge", plan WP-C): the same invite as
 * /i/<code>, with the badge card as the link preview (opengraph-image.tsx beside this). Never indexed.
 */
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const res = await getPublicInvite(code);
  const base: Metadata = { robots: { index: false, follow: false } };
  if (res.status !== "ok") return { ...base, title: "Join your neighbours on myHoodora" };
  const { inviter, hood } = res.invite;
  const label = badgeLabel(res.invite.badge) ?? "neighbour";
  const title = `${inviter.firstName} is a ${label} on myHoodora`;
  const description = hood ? `Join ${inviter.firstName} and your neighbours in ${hood.name}: safety alerts, trusted recommendations, things for sale and events near you.` : "Join your neighbours: safety alerts, trusted recommendations, things for sale and events near you.";
  return { ...base, title, description, openGraph: { title, description, siteName: "myHoodora", url: `/i/${res.invite.code}/badge` }, twitter: { card: "summary_large_image", title, description } };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  const res = await getPublicInvite(code);
  return <InviteLanding invite={res.status === "ok" ? res.invite : null} code={code} fromPoster={false} fromBadge />;
}
