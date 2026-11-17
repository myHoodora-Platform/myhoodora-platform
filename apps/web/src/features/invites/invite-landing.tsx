"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, HeartHandshake, ShoppingBag, Smartphone } from "lucide-react";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { normaliseInviteCode, type PublicInvite } from "@myhoodora/api-contract/invites";
import { PLAY_STORE_URL, inAppBrowser } from "@/features/shared-post/shared-visit";
import { rememberInviteRef } from "./invite-ref";
import { trackFunnel } from "@/lib/api/funnel";

const WHY = [
  { Icon: BellRing, title: "Safety alerts", text: "Hear first when something happens on your street." },
  { Icon: HeartHandshake, title: "Trusted recommendations", text: "The electrician, tailor or mechanic your neighbours actually use." },
  { Icon: ShoppingBag, title: "Buy, sell and give away", text: "Things for sale and events, a short walk away." },
];

/** The /i/<code> landing page: who invited them, why join, and the code to type in the app. */
export function InviteLanding({ invite, code, fromPoster }: { invite: PublicInvite | null; code: string; fromPoster: boolean }) {
  const shownCode = invite?.code ?? normaliseInviteCode(code);
  const [webview, setWebview] = useState(false);

  useEffect(() => {
    if (shownCode) rememberInviteRef(shownCode, fromPoster ? "qr" : "link");
    trackFunnel(fromPoster ? "poster_view" : "invite_view");
    setWebview(inAppBrowser(navigator.userAgent));
  }, [shownCode, fromPoster]);

  const join = `/register${shownCode ? `?ref=${shownCode}` : ""}`;
  // The Play Store hands this to the app on its first launch (core/invites/install-referrer.ts there).
  const play = `${PLAY_STORE_URL}${shownCode ? `&referrer=${encodeURIComponent(`ref=${shownCode}${fromPoster ? "&src=qr" : ""}`)}` : ""}`;
  const who = invite?.inviter.firstName;

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/" aria-label="myHoodora home">
            <MascotWordmark className="h-7 w-auto" />
          </Link>
          <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        {webview && <p className="mb-4 text-center text-xs text-muted-foreground">For the best experience, open this link in your browser or the myHoodora app.</p>}
        <section className="rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border sm:p-8">
          {who ? (
            <>
              <span aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {who[0]}
              </span>
              <h1 className="mt-4 text-2xl font-bold text-balance">{who} invited you to myHoodora</h1>
              <p className="mt-2 text-muted-foreground">
                {invite?.hood ? `Join ${who} and your neighbours in ${invite.hood.name}${invite.hood.city ? `, ${invite.hood.city}` : ""}.` : "Join your neighbours and find out what's happening near you."}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-balance">Join your neighbours on myHoodora</h1>
              <p className="mt-2 text-muted-foreground">{shownCode ? "We couldn't find this invite, but you're still welcome." : "The app for your neighbourhood."}</p>
            </>
          )}

          <ul className="mt-6 space-y-3 text-left">
            {WHY.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <Link href={join} className="mt-7 block w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground hover:bg-primary/90">
            Create your free account
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">Free, and only for verified neighbours. We check your address, never share it.</p>
        </section>

        <section className="mt-4 rounded-3xl bg-card p-6 text-center ring-1 ring-border">
          <Smartphone className="mx-auto size-6 text-primary" aria-hidden />
          <h2 className="mt-2 font-semibold">Prefer the app?</h2>
          {shownCode && (
            <p className="mt-1 text-sm text-muted-foreground">
              When you sign up, enter {who ? `${who}'s` : "this"} invite code:
              <span className="mt-2 block font-mono text-3xl font-bold tracking-[0.25em] text-foreground">{shownCode}</span>
            </p>
          )}
          <a href={play} className="mt-4 inline-flex rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            Get it on Google Play
          </a>
        </section>
      </main>
    </div>
  );
}
