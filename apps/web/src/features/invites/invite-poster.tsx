"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { normaliseInviteCode } from "@myhoodora/api-contract/invites";
import { useAuth } from "@/context/AuthContext";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { getPublicInvite } from "@/lib/api/invites";
import { ROUTES } from "@/lib/routes";
import { loadInvites, useInviteSummary } from "./use-invites";
import { posterQr } from "./poster-qr";

/**
 * A printable A4 poster (plan WP-E, path 5) for the estate gate, church, mosque or market: a QR code to
 * the invite link (`?src=qr`, so we know posters work) and the code to type in the app. Your own by
 * default; `?code=` prints someone else's (staff print them for Hood Leads from the admin).
 */
export function InvitePoster() {
  const { user, profile } = useAuth();
  const params = useSearchParams();
  const asked = normaliseInviteCode(params.get("code"));
  const mine = useInviteSummary(user?.uid);
  const myHood = useNeighbourhood()?.name;
  const [other, setOther] = useState<{ firstName: string; hood?: string } | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (user && !asked && !mine) void loadInvites(user).catch(() => setMissing(true));
  }, [user, asked, mine]);
  useEffect(() => {
    if (!asked || asked === mine?.code) return;
    void getPublicInvite(asked).then((r) => (r.status === "ok" ? setOther({ firstName: r.invite.inviter.firstName, hood: r.invite.hood?.name }) : setMissing(true)));
  }, [asked, mine?.code]);

  const code = asked ?? mine?.code ?? null;
  const name = asked && asked !== mine?.code ? other?.firstName : profile?.displayName?.split(/\s+/)[0];
  const hood = asked && asked !== mine?.code ? other?.hood : myHood;
  const link = code ? `${window.location.origin}${ROUTES.inviteLink(code)}` : null;

  useEffect(() => {
    if (!link) return;
    void posterQr(link).then(setSvg);
  }, [link]);

  if (missing) return <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-border">We couldn&apos;t find that invite code.</p>;
  if (!code || !svg || !link) return <div className="h-[70vh] animate-pulse rounded-2xl bg-muted" aria-label="Making the poster" />;

  return <PosterSheet code={code} name={name} hood={hood} svg={svg} link={link} back={ROUTES.invite} />;
}

/** The poster itself, with Print; only the poster reaches the paper. Also served publicly at /i/<code>/poster. */
export function PosterSheet({ code, name, hood, svg, link, back }: { code: string; name?: string; hood?: string; svg: string; link: string; back?: string }) {
  return (
    <div className="space-y-4">
      {/* Only the poster prints: the app around it and these controls are hidden on paper. */}
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        .invite-poster, .invite-poster * { visibility: visible !important; }
        .invite-poster { position: fixed; inset: 0; width: 210mm; height: 297mm; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
      }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back ? (
          <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Invite neighbours
          </Link>
        ) : (
          <span />
        )}
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print or save as PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">
        A4, in colour or black and white. Put it up where neighbours pass every day: the estate gate, a notice board, your church, mosque or market. Ask first where it isn&apos;t yours to put up.
      </p>

      <article className="invite-poster mx-auto flex aspect-[210/297] w-full max-w-[560px] flex-col items-center overflow-hidden rounded-2xl bg-white text-center text-[#0b3d2e] shadow-sm ring-1 ring-border">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-evenly px-[8%] py-[4%]">
          {/* The friendly app icon (it carries the name too): what neighbours will see on their home screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a print page; 640px so it stays sharp on paper */}
          <img src="/logo/app-icon-print.png" alt="myHoodora" className="w-[30%] max-w-[180px]" />
          <h1 className="text-[clamp(1.2rem,4.2vw,2.1rem)] leading-tight font-extrabold text-balance">{hood ? `Neighbours of ${hood}, let's connect!` : "Neighbours, let's connect!"}</h1>
          <p className="text-[clamp(0.8rem,2.1vw,1.05rem)] font-medium text-[#2e5d4f]">Safety alerts · trusted recommendations · buy, sell and give away · events near you</p>
          <div className="w-[38%] rounded-2xl border-4 border-[#0b3d2e] p-[3%]" role="img" aria-label={`QR code for ${link}`} dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-[clamp(0.95rem,2.7vw,1.4rem)] font-bold">Scan with your phone camera to join</p>
          <p className="text-[clamp(0.75rem,2vw,1rem)]">Or get the myHoodora app and enter this invite code:</p>
          <p className="-mt-[2%] font-mono text-[clamp(1.6rem,6vw,3rem)] font-extrabold tracking-[0.2em]">{code}</p>
        </div>
        <footer className="w-full shrink-0 bg-[#0b3d2e] px-[8%] py-[3.5%] text-white">
          <p className="text-[clamp(0.8rem,2.2vw,1.05rem)] font-semibold">{name ? `Invited by ${name}, your neighbour` : "Invited by a neighbour"}</p>
          <p className="mt-1 text-[clamp(0.7rem,1.9vw,0.9rem)] opacity-90">Free · only for verified neighbours · {link.replace(/^https?:\/\//, "")}</p>
        </footer>
      </article>
    </div>
  );
}
