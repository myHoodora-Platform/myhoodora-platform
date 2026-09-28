import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  EyeOff,
  Flag,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  ThumbsUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SmartImage } from "@myhoodora/ui/image";
import { BUSINESS_IMAGE, HERO_IMAGE } from "@/lib/site-images";
import { SignupCard } from "./signup-card";
import { IPhoneMockup } from "./iphone-mockup";
import { PhoneAppScreen } from "./phone-app-screen";

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase ${className}`}>
      {children}
    </p>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

function SecondaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

// ── Hero: Lagos street photo + sign-up card (Nextdoor homepage pattern) ─────

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <SmartImage
        fill
        priority
        quality={90}
        className="-z-10 object-cover"
        style={{ objectPosition: HERO_IMAGE.position ?? "50% 45%" }}
        alt={HERO_IMAGE.alt}
        src={HERO_IMAGE.src}
      />
      {/* Legibility: dark on the copy side, clearing towards the card */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0b1716]/80 via-[#0b1716]/65 to-[#0b1716]/85 lg:bg-gradient-to-r lg:from-[#0b1716]/90 lg:via-[#0b1716]/60 lg:to-[#0b1716]/30" />
      <div className={`${container} grid min-h-[calc(100dvh-4rem)] items-center gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20`}>
        <div className="space-y-6 text-center text-white lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur">
            <MapPin className="size-3.5" aria-hidden /> Now live in Lagos &amp; Ibadan
          </p>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Know what&apos;s happening <span className="text-[#7fd6cb]">on your street.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-white/85 lg:mx-0">
            myHoodora connects verified neighbours in your estate and neighbourhood: security alerts, trusted artisans,
            things for sale, events and more.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/85 lg:justify-start">
            {[
              [UserCheck, "Verified neighbours only"],
              [Lock, "Your address is never shown"],
              [BadgeCheck, "Free for residents"],
            ].map(([Icon, label]) => {
              const I = Icon as LucideIcon;
              return (
                <li key={label as string} className="flex items-center gap-1.5">
                  <I className="size-4 text-[#7fd6cb]" aria-hidden />
                  {label as string}
                </li>
              );
            })}
          </ul>
        </div>
        <SignupCard className="mx-auto max-w-md lg:mr-0" />
      </div>
    </section>
  );
}

// ── The app, on a real phone ────────────────────────────────────────────────

export function PhoneShowcase() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-canvas to-background py-16 lg:py-24">
      <div className={`${container} grid items-center gap-12 lg:grid-cols-2`}>
        <div className="space-y-5 text-center lg:text-left">
          <Eyebrow>Your neighbourhood at a glance</Eyebrow>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything happening near you, in one feed</h2>
          <p className="text-lg text-muted-foreground">
            Alerts are summarised at the top so you never miss what matters. Below them: recommendations, polls, things
            for sale and events from people who live near you.
          </p>
          <ul className="mx-auto max-w-md space-y-3 text-left lg:mx-0">
            {[
              "Urgent alerts reach everyone in minutes",
              "Ask who's good, and hear from people who've used them",
              "Chat privately, no need to share your number",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center pb-6">
          <IPhoneMockup
            className="w-[280px] sm:w-[310px] lg:w-[330px]"
            label="The myHoodora app on an iPhone, showing active alerts and posts from neighbours in Lekki Phase 1"
          >
            <PhoneAppScreen />
          </IPhoneMockup>
        </div>
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────────────────────

const FEATURES: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  {
    icon: AlertTriangle,
    title: "Alerts that matter",
    body: "Security, power, flooding and traffic updates from neighbours, grouped so you're informed without being overwhelmed. Urgent alerts reach everyone at once.",
    tone: "bg-danger-soft text-destructive",
  },
  {
    icon: ThumbsUp,
    title: "Trusted recommendations",
    body: "Find a reliable electrician, tailor, mechanic or lesson teacher, recommended by people who actually live near you.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: ShoppingBag,
    title: "For Sale & Free",
    body: "Buy, sell and give things away within your neighbourhood. Prices in naira, meet at the estate gate.",
    tone: "bg-warning-soft text-warning",
  },
  {
    icon: CalendarDays,
    title: "Events",
    body: "Sanitation days, residents' meetings, owambes and Saturday 5-a-side, with RSVPs so organisers know who's coming.",
    tone: "bg-info-soft text-info",
  },
  {
    icon: Users,
    title: "Groups & polls",
    body: "Your street, your estate, parents, safety watch. Create groups and run polls to decide things together.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: MessageCircle,
    title: "Private messages",
    body: "Chat with neighbours and sellers without swapping phone numbers until you're ready.",
    tone: "bg-secondary text-foreground",
  },
];

export function Features() {
  return (
    <section className="py-16 lg:py-24">
      <div className={container}>
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">No more scrolling through ten WhatsApp groups</h2>
          <p className="text-lg text-muted-foreground">
            The things neighbours in Nigeria need every day, organised and easy to find.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${f.tone}`}>
                <f.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  { title: "Create your account", body: "Sign up with your email or Google in under a minute." },
  {
    title: "Confirm where you live",
    body: "We check your location once to place you in the right neighbourhood. Your exact address stays private.",
  },
  { title: "Meet your neighbours", body: "See what's happening, ask for recommendations and get alerts from people nearby." },
];

export function Steps() {
  return (
    <section className="bg-canvas py-16 lg:py-24">
      <div className={container}>
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>Getting started</Eyebrow>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Join in three simple steps</h2>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <PrimaryCta href="/register">
            Get started, it&apos;s free <ArrowRight className="size-4" aria-hidden />
          </PrimaryCta>
        </div>
      </div>
    </section>
  );
}

// ── Safety strip: the full story lives on /safety ──────────────────────────

export function SafetyTeaser() {
  return (
    <section className="px-4 pt-16 pb-6 sm:px-6 lg:px-8 lg:pt-20">
      <Link
        href="/safety"
        className="group mx-auto flex max-w-6xl flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:p-8"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <ShieldCheck className="size-7" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-2">
          <span className="block text-xl font-bold tracking-tight sm:text-2xl">A safer space than a public group chat</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-muted-foreground">
            {[
              [UserCheck, "Verified neighbours only"],
              [EyeOff, "Your address stays private"],
              [Flag, "Report & block in two taps"],
            ].map(([Icon, label]) => {
              const I = Icon as LucideIcon;
              return (
                <span key={label as string} className="inline-flex items-center gap-1.5">
                  <I className="size-4 text-primary" aria-hidden /> {label as string}
                </span>
              );
            })}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 font-bold text-primary">
          How we keep you safe <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </Link>
    </section>
  );
}

// ── For business teaser ─────────────────────────────────────────────────────

export function BusinessTeaser() {
  return (
    <section className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl text-white">
        <SmartImage fill className="-z-10 object-cover" alt="" src={BUSINESS_IMAGE.src} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1716]/95 via-[#0b1716]/80 to-[#0b1716]/40" />
        <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              <Building2 className="size-3.5" aria-hidden /> For business
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your next customers live around the corner</h2>
            <p className="text-lg text-white/85">
              Artisans, shops, caterers, salons, schools and estate managers: reach verified residents near you with a free
              Business Page, and let neighbours&apos; recommendations do the rest.
            </p>
            <Link
              href="/business"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-primary transition-colors hover:bg-white/90"
            >
              Explore myHoodora for business <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="space-y-3">
            {[
              [BadgeCheck, "Free Business Page"],
              [MessageCircle, "Free posts to nearby neighbours"],
              [ThumbsUp, "Recommendations you can't buy, only earn"],
              [Building2, "Official pages for estates & associations"],
            ].map(([Icon, label]) => {
              const I = Icon as LucideIcon;
              return (
                <li key={label as string} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-semibold backdrop-blur">
                  <I className="size-5 shrink-0" aria-hidden />
                  {label as string}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── FAQ + final call to action ──────────────────────────────────────────────

const FAQS = [
  { q: "Is myHoodora free?", a: "Yes. myHoodora is free for residents." },
  {
    q: "Who can see my address?",
    a: "No one. We use your location once to confirm your neighbourhood. Neighbours only see your name and neighbourhood, never your street or house number.",
  },
  {
    q: "How do you know people are real neighbours?",
    a: "Everyone confirms where they live when they join. Only verified neighbours can use alerts, events, groups and For Sale & Free.",
  },
  {
    q: "Is it only for gated estates?",
    a: "No. It works for estates, streets and open neighbourhoods alike. Estates and residents' associations can also run an official group.",
  },
  { q: "Can I use it on my phone?", a: "Yes. myHoodora works in any phone browser, and it's designed mobile-first." },
];

export function Faq() {
  return (
    <section className="bg-canvas py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions neighbours ask</h2>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-base font-semibold marker:hidden">
                {f.q}
                <span aria-hidden className="text-2xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-2xl space-y-6 px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Be part of your neighbourhood</h2>
        <p className="text-lg text-muted-foreground">Verified neighbours, local alerts and trusted recommendations. Free to join.</p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryCta href="/register">
            Join myHoodora <ArrowRight className="size-4" aria-hidden />
          </PrimaryCta>
          <SecondaryCta href="/login">
            <Check className="size-4" aria-hidden /> I already have an account
          </SecondaryCta>
        </div>
      </div>
    </section>
  );
}
