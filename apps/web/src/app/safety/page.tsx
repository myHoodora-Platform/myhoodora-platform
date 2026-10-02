import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  EyeOff,
  Flag,
  HeartHandshake,
  Phone,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { SmartImage } from "@myhoodora/ui/image";
import { ExploreMore } from "@/components/marketing/explore-more";
import { MarketingPage, PageIntro } from "@/components/marketing/marketing-page";
import { TRUST_IMAGE } from "@/lib/site-images";

export const metadata: Metadata = publicPageMetadata("/safety", {
  title: "Safety & trust | myHoodora",
  description:
    "Verified neighbours, a private address, kindness reminders and easy reporting. Here's how myHoodora keeps your neighbourhood safe.",
});

const PROMISES = [
  { icon: UserCheck, title: "Real, verified neighbours", body: "Everyone confirms where they live, so you're talking to people from your area, not strangers." },
  { icon: EyeOff, title: "Your address stays private", body: "Neighbours only see your name and neighbourhood, never your street or house number." },
  { icon: HeartHandshake, title: "Kindness built in", body: "Gentle reminders before posting something hurtful, and community guidelines everyone agrees to." },
  { icon: Flag, title: "Report and block", body: "Report posts, comments, listings or people in two taps, and block anyone you don't want to hear from." },
];

const SAFEGUARDS = [
  { icon: UserCheck, title: "Verified neighbours", body: "Alerts, events, groups and For Sale & Free are open only to residents who have confirmed where they live." },
  { icon: EyeOff, title: "Your address stays private", body: "We use your location to find your neighbourhood. We never show your street, house number or coordinates to anyone." },
  { icon: AlertTriangle, title: "Alerts built to stay useful", body: "Urgent alerts are for danger happening now. They show to everyone for 2 hours, then alerts end automatically or when the poster marks them resolved." },
  { icon: HeartHandshake, title: "Kindness reminders", body: "If a post or comment looks hurtful, we'll suggest a second look before it goes out." },
  { icon: Flag, title: "Report and block", body: "Report any post, comment, listing, message or person. Reports are private. Block anyone you don't want to hear from." },
  { icon: ShieldCheck, title: "Group admins and moderation", body: "Group admins look after their groups, and reported content is reviewed against our community guidelines." },
];

const IF_WRONG = [
  { n: "1", title: "Danger now? Call 112", body: "Emergency services first, always. Then post an urgent alert so neighbours can help." },
  { n: "2", title: "Report it", body: "Tap ••• on any post, comment, message or profile and choose Report. The person isn't told who reported them." },
  { n: "3", title: "Block if you need to", body: "Blocking hides their posts and stops them messaging you." },
];

export default function SafetyPage() {
  return (
    <MarketingPage>
      <PageIntro
        eyebrow="Safety & trust"
        title="Your home is your safe place. Your hood should be too."
        description="myHoodora is built so only real neighbours are in the conversation, your personal details stay yours, and help is a tap away."
      />

      {/* Trust promises */}
      <section className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border">
            <SmartImage fill quality={90} sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" alt={TRUST_IMAGE.alt} src={TRUST_IMAGE.src} />
            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-bold">Verified neighbour</span>
                <span className="block text-xs text-muted-foreground">Lekki Phase 1, Lagos</span>
              </span>
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">Trust &amp; safety</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">A safer space than a public group chat</h2>
              <p className="text-lg text-muted-foreground">
                In Nigeria, your home is your safe place. myHoodora is built so only real neighbours are in the conversation,
                and your personal details stay yours.
              </p>
            </div>
            <ul className="space-y-4">
              {PROMISES.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-bold">{s.title}</span>
                    <span className="block text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <Link href="/guidelines" className="text-primary hover:underline">
                Read our community guidelines
              </Link>
              <Link href="/privacy" className="text-primary hover:underline">
                How we protect your data
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Safeguards */}
      <section id="safeguards" className="scroll-mt-20 bg-canvas px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">Safety</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How we keep your neighbourhood safe</h2>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map((s) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <s.icon className="size-7 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-destructive/25 bg-danger-soft/50 p-5">
            <Phone className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <p className="text-foreground/85">
              <span className="font-bold">myHoodora is not an emergency service.</span> If someone is in danger, call the
              national emergency number <span className="font-bold">112</span> first, then alert your neighbours.
            </p>
          </div>
        </div>
      </section>

      {/* If something goes wrong */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">If something goes wrong</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {IF_WRONG.map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{s.n}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90">
              Join your verified neighbours <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <ExploreMore items={["how-it-works", "about", "guidelines"]} className="bg-canvas" />
    </MarketingPage>
  );
}
