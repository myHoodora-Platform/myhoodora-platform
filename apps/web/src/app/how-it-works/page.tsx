import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  MapPin,
  MessageCircle,
  ShoppingBag,
  ThumbsUp,
  UserCheck,
  Users,
} from "lucide-react";
import { IPhoneMockup } from "@/components/marketing/iphone-mockup";
import { MarketingPage, PageIntro } from "@/components/marketing/marketing-page";
import { ExploreMore } from "@/components/marketing/explore-more";
import { PhoneAppScreen } from "@/components/marketing/phone-app-screen";

export const metadata: Metadata = {
  title: "How myHoodora works",
  description: "Join, confirm your neighbourhood and connect with verified neighbours. Here's how myHoodora works and how we keep it safe.",
};

const STEPS = [
  {
    icon: UserCheck,
    title: "Create your account",
    body: "Sign up with your email or Google. Use your real name, because neighbours trust people they can recognise.",
  },
  {
    icon: MapPin,
    title: "Confirm your neighbourhood",
    body: "Enter your address and let us check your location once. We place you in the right neighbourhood. Neighbours only ever see its name, never your address.",
  },
  {
    icon: Users,
    title: "Explore your neighbourhood",
    body: "Your Home feed shows what neighbours are sharing, with active alerts summarised at the top so you never miss what matters.",
  },
  {
    icon: MessageCircle,
    title: "Post, ask and help",
    body: "Ask for a recommendation, sell something, share an event, run a poll, thank a neighbour, or alert everyone when something's wrong.",
  },
];

const PLACES = [
  { icon: AlertTriangle, title: "Alerts", body: "Security, power, water, flooding, traffic, fire and scam warnings, grouped by type and kept for a week." },
  { icon: ShoppingBag, title: "For Sale & Free", body: "Sell or give away within your neighbourhood, with prices in naira and private messages to arrange pick-up." },
  { icon: CalendarDays, title: "Events", body: "See what's coming up and tap Going or Interested." },
  { icon: Users, title: "Groups", body: "Join your street, estate, parents' network or safety watch, or start your own." },
  { icon: BarChart3, title: "Polls", body: "Ask neighbours to vote. Votes are anonymous, and you can change yours while the poll is open." },
  { icon: ThumbsUp, title: "Recommendations", body: "Ask who's good, and hear from people who've actually used them." },
];

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <PageIntro
        eyebrow="How it works"
        title="Your neighbourhood, in your pocket"
        description="myHoodora is a private space for verified neighbours to share what's happening, help each other and stay safe."
      />

      <section className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_auto]">
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span>
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <s.icon className="size-5 text-primary" aria-hidden /> {s.title}
                  </span>
                  <span className="mt-1 block leading-relaxed text-muted-foreground">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex justify-center pb-6">
            <IPhoneMockup className="w-[260px] sm:w-[290px]" label="The myHoodora Home feed on an iPhone">
              <PhoneAppScreen />
            </IPhoneMockup>
          </div>
        </div>
      </section>

      <section className="bg-canvas px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">What&apos;s inside</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLACES.map((p) => (
              <li key={p.title} className="rounded-2xl border border-border bg-card p-6">
                <p.icon className="size-7 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
                <p className="mt-1 text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to meet your neighbours?</h2>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90">
              Join myHoodora <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/guidelines" className="inline-flex h-12 items-center rounded-full border border-border px-6 font-semibold hover:bg-muted">
              Read the community guidelines
            </Link>
          </div>
        </div>
      </section>

      <ExploreMore items={["safety", "about", "business"]} className="bg-canvas" />
    </MarketingPage>
  );
}
