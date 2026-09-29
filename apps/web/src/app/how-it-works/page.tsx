import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
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

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="relative isolate mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-primary text-primary-foreground lg:grid-cols-[1.15fr_0.85fr]">
          {/* Subtle dot texture + glow behind the phone */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div aria-hidden className="absolute -right-24 -bottom-40 -z-10 size-[34rem] rounded-full bg-white/10" />

          <div className="space-y-6 px-6 py-14 text-center sm:px-12 lg:py-20 lg:pr-4 lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              <MapPin className="size-3.5" aria-hidden /> Free for residents
            </p>
            <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-5xl">Ready to meet your neighbours?</h2>
            <p className="mx-auto max-w-lg text-lg text-primary-foreground/85 lg:mx-0">
              Join in about a minute, confirm your neighbourhood, and see what&apos;s happening on your street today.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 font-bold text-primary shadow-lg transition-colors hover:bg-white/90"
              >
                Join myHoodora <ArrowRight className="size-4" aria-hidden />
              </Link>
              <p className="text-sm text-primary-foreground/80">
                Already a member?{" "}
                <Link href="/login" className="font-bold text-white underline-offset-4 hover:underline">
                  Log in
                </Link>
              </p>
            </div>
            <ul className="flex flex-col items-center gap-2 pt-2 text-sm text-primary-foreground/90 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 lg:justify-start">
              {["Verified neighbours only", "Your address stays private", "Report & block in two taps"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Phone rising out of the card's bottom edge, with live-looking updates */}
          <div className="relative flex items-end justify-center px-6 pt-4 lg:pt-14">
            <IPhoneMockup crop={0.6} className="w-[230px] sm:w-[260px]" label="Neighbours posting on the myHoodora Home feed">
              <PhoneAppScreen />
            </IPhoneMockup>
            <div
              aria-hidden
              className="absolute top-10 left-2 hidden max-w-[230px] rounded-2xl bg-card p-3 text-foreground shadow-xl sm:block lg:top-24 lg:-left-6"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-coral text-xs font-bold text-white">CE</span>
                <span>
                  <span className="block text-xs font-bold">Chidinma Eze</span>
                  <span className="block text-[11px] text-muted-foreground">Lekki Phase 1 · 2 min</span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-snug">Anyone recommend a reliable electrician? My inverter keeps tripping 🙏</p>
            </div>
            <div
              aria-hidden
              className="absolute right-3 bottom-16 hidden items-center gap-2 rounded-full bg-card py-2 pr-4 pl-2 text-foreground shadow-xl sm:flex lg:-right-2"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm">👍</span>
              <span className="text-xs font-bold">6 neighbours replied</span>
            </div>
          </div>
        </div>
      </section>

      <ExploreMore items={["safety", "about", "business"]} className="bg-canvas" />
    </MarketingPage>
  );
}
