import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Download, Mail, Newspaper, Palette } from "lucide-react";
import { ExploreMore } from "@/components/marketing/explore-more";
import { IPhoneMockup, PhoneStage } from "@/components/marketing/iphone-mockup";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { PhoneAppScreen } from "@/components/marketing/phone-app-screen";
import { BusinessPageScreen, BusinessPostScreen, RecommendationScreen } from "@/components/marketing/business-screens";
import { COVERAGE_COUNT } from "@/lib/coverage";
import { ANNOUNCEMENTS } from "@/lib/press";
import { HOODORA_AI_LOGO } from "@/lib/site-images";

export const metadata: Metadata = {
  title: "Press & media | myHoodora",
  description: "News, fast facts, logos and product imagery for journalists and partners writing about myHoodora.",
};

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const FACTS = [
  { value: "Lagos & Ibadan", label: "Where we're live today" },
  { value: String(COVERAGE_COUNT), label: "Neighbourhoods open" },
  { value: "Free", label: "For every resident" },
  { value: "3", label: "Products: neighbourhoods, Business, AI" },
];

const LOGOS = [
  { name: "Mascot lockup", preview: "/logo/mascot-lockup-640.webp", file: "/logo/mascot-lockup-1024.webp", format: "WEBP", dark: false },
  { name: "Horizontal logo", preview: "/logo/logo-horizontal.svg", file: "/logo/logo-horizontal.svg", format: "SVG", dark: false },
  { name: "Horizontal, reversed", preview: "/logo/logo-horizontal-reversed.svg", file: "/logo/logo-horizontal-reversed.svg", format: "SVG", dark: true },
  { name: "Stacked logo", preview: "/logo/logo-stacked.svg", file: "/logo/logo-stacked.svg", format: "SVG", dark: false },
  { name: "App mark", preview: "/logo/mark.svg", file: "/logo/mark.svg", format: "SVG", dark: false },
  { name: "myHoodora AI", preview: HOODORA_AI_LOGO, file: HOODORA_AI_LOGO, format: "WEBP", dark: false },
];

// From the myHoodora Brand Style Guide v1.0.
const COLOURS = [
  { name: "Brand Teal", hex: "#147C73", className: "bg-[#147C73] text-white" },
  { name: "Brand Coral", hex: "#FF6B5A", className: "bg-[#FF6B5A] text-white" },
  { name: "Brand Gray", hex: "#F2F2F2", className: "bg-[#F2F2F2] text-[#171717] ring-1 ring-border" },
  { name: "Foreground", hex: "#171717", className: "bg-[#171717] text-white" },
];

const SCREENS = [
  { label: "Home feed", screen: <PhoneAppScreen />, tone: "primary" as const },
  { label: "Business Post", screen: <BusinessPostScreen />, tone: "coral" as const },
  { label: "Recommendations", screen: <RecommendationScreen />, tone: "primary" as const },
  { label: "Business Page", screen: <BusinessPageScreen />, tone: "coral" as const },
];

export default function PressPage() {
  const [featured, ...rest] = ANNOUNCEMENTS;

  return (
    <MarketingPage>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-canvas to-background">
        <div className={`${container} space-y-6 py-16 text-center lg:py-20`}>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
            <Newspaper className="size-3.5" aria-hidden /> Newsroom
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            News and resources for the media
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            The latest from myHoodora, fast facts, logos and product imagery, all in one place.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="#media-kit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden /> Media kit
            </Link>
            <Link
              href="/contact?topic=press"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-6 font-semibold hover:bg-muted"
            >
              <Mail className="size-4" aria-hidden /> Press enquiries
            </Link>
          </div>
        </div>
      </section>

      {/* ── Fast facts ──────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <dl className={`${container} grid grid-cols-2 gap-6 py-10 lg:grid-cols-4`}>
          {FACTS.map((f) => (
            <div key={f.label} className="text-center">
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{f.value}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{f.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Announcements: featured + list ──────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className={container}>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Latest from myHoodora</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {featured && (
              <Link
                href={featured.href}
                className="group relative isolate flex min-h-[420px] flex-col justify-end overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground transition-shadow hover:shadow-xl"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10 opacity-[0.12]"
                  style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                <div aria-hidden className="absolute right-6 bottom-0 -z-10 hidden sm:block lg:right-8">
                  <IPhoneMockup crop={0.62} className="w-[170px] lg:w-[190px]" label="">
                    <PhoneAppScreen />
                  </IPhoneMockup>
                </div>
                <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">{featured.tag}</span>
                <h3 className="mt-4 max-w-md text-2xl font-bold tracking-tight sm:max-w-[58%] sm:text-3xl">{featured.title}</h3>
                <p className="mt-2 max-w-md text-primary-foreground/85 sm:max-w-[58%]">{featured.summary}</p>
                <span className="mt-5 inline-flex items-center gap-2 font-bold">
                  Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            )}
            <ul className="grid gap-6">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <span className="w-fit rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-coral uppercase">{a.tag}</span>
                    <h3 className="mt-3 text-xl font-bold tracking-tight">{a.title}</h3>
                    <p className="mt-1 flex-1 text-muted-foreground">{a.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                      Learn more <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Media kit ───────────────────────────────────────────────────── */}
      <section id="media-kit" className="scroll-mt-20 bg-canvas py-16 lg:py-24">
        <div className={container}>
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">Media kit</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Logos, colours and product imagery</h2>
            <p className="text-lg text-muted-foreground">
              Free to use when writing about myHoodora. Please don&apos;t stretch, recolour or alter the logos.
            </p>
          </div>

          {/* Logos */}
          <h3 className="mt-12 text-lg font-bold">Logos</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOGOS.map((l) => (
              <li key={l.name} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className={`flex h-40 items-center justify-center p-6 ${l.dark ? "bg-[#0B1716]" : "bg-white"}`}>
                  <Image src={l.preview} alt={`${l.name} preview`} width={320} height={160} unoptimized className="max-h-28 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <span>
                    <span className="block text-sm font-bold">{l.name}</span>
                    <span className="block text-xs text-muted-foreground">{l.format}</span>
                  </span>
                  <a
                    href={l.file}
                    download
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Download className="size-4" aria-hidden /> Download
                  </a>
                </div>
              </li>
            ))}
          </ul>

          {/* Colours */}
          <h3 className="mt-12 flex items-center gap-2 text-lg font-bold">
            <Palette className="size-5 text-primary" aria-hidden /> Brand colours
          </h3>
          <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {COLOURS.map((c) => (
              <li key={c.hex} className={`flex h-28 flex-col justify-end rounded-2xl p-4 ${c.className}`}>
                <span className="font-bold">{c.name}</span>
                <span className="font-mono text-sm opacity-80">{c.hex}</span>
              </li>
            ))}
          </ul>

          {/* Product imagery */}
          <h3 className="mt-12 text-lg font-bold">Product imagery</h3>
          <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {SCREENS.map((s) => (
              <li key={s.label}>
                <PhoneStage tone={s.tone} className="px-3 pt-8">
                  <IPhoneMockup crop={0.7} className="w-[130px] sm:w-[170px]" label={`myHoodora ${s.label} screen`}>
                    {s.screen}
                  </IPhoneMockup>
                </PhoneStage>
                <p className="mt-2 text-center text-sm font-semibold">{s.label}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Need high-resolution screenshots, founder photos or something else?{" "}
            <Link href="/contact?topic=press" className="font-semibold text-primary hover:underline">
              Ask the press team
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Press contact ───────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 rounded-[2rem] border border-border bg-card p-8 text-center shadow-sm sm:p-12 lg:flex-row lg:text-left">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Mail className="size-8" aria-hidden />
          </span>
          <div className="flex-1 space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Writing a story?</h2>
            <p className="text-muted-foreground">
              For interviews, comments and assets, contact our press team. We reply to journalists as quickly as we can.
            </p>
          </div>
          <Link
            href="/contact?topic=press"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90"
          >
            Contact press team <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <ExploreMore items={["about", "business", "ai"]} className="bg-canvas" />
    </MarketingPage>
  );
}
