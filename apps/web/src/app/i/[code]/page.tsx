import type { Metadata } from "next";
import { InviteLanding } from "@/features/invites/invite-landing";
import { getPublicInvite } from "@/lib/api/invites";

/**
 * A neighbour's personal invite link, myhoodora.com/i/<code> (plan WP-E, path 1; `?src=qr` from a
 * printed poster, path 5). Public; never indexed. Whoever opens it gets their code remembered until
 * they've signed up.
 */
type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const res = await getPublicInvite(code);
  const base: Metadata = { robots: { index: false, follow: false } };
  if (res.status !== "ok") return { ...base, title: "Join your neighbours on myHoodora", description: "The app for your neighbourhood: safety alerts, trusted recommendations, things for sale and events near you." };
  const { inviter, hood } = res.invite;
  const title = `${inviter.firstName} invited you to myHoodora`;
  const description = hood ? `Join ${inviter.firstName} and your neighbours in ${hood.name}: safety alerts, trusted recommendations, things for sale and events near you.` : "Join your neighbours: safety alerts, trusted recommendations, things for sale and events near you.";
  return { ...base, title, description, openGraph: { title, description, siteName: "myHoodora", url: `/i/${res.invite.code}` }, twitter: { card: "summary", title, description } };
}

export default async function Page({ params, searchParams }: Props) {
  const { code } = await params;
  const src = (await searchParams).src;
  const res = await getPublicInvite(code);
  return <InviteLanding invite={res.status === "ok" ? res.invite : null} code={code} fromPoster={src === "qr"} />;
}
