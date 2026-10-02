import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import Link from "next/link";
import { SmartImage } from "@myhoodora/ui/image";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Code2,
  Handshake,
  Headphones,
  MapPin,
  Palette,
  Rocket,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ExploreMore } from "@/components/marketing/explore-more";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { TalentForm } from "@/features/company/talent-form";
import { OPEN_ROLES, type OpenRole } from "@/lib/careers";
import { COVERAGE_COUNT } from "@/lib/coverage";
import { CAREERS_IMAGE } from "@/lib/site-images";

export const metadata: Metadata = publicPageMetadata("/careers", {
  title: "Careers | myHoodora",
  description: "Help build stronger hoods across Nigeria. See open roles at myHoodora, or join our talent network.",
});

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";


const TEAMS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Code2, title: "Engineering", body: "Web, mobile and APIs that stay fast on a patchy 3G connection." },
  { icon: Palette, title: "Product & design", body: "Simple, warm experiences for every kind of neighbour, from Gen Z to grandma." },
  { icon: ShieldCheck, title: "Community & trust", body: "Verification, moderation and the guidelines that keep hoods safe and kind." },
  { icon: Handshake, title: "Growth & partnerships", body: "Estates, residents' associations, local businesses and schools." },
  { icon: Headphones, title: "Operations & support", body: "Helping neighbours and businesses get the most out of myHoodora." },
];

const WHY_NOW = [
  { icon: Rocket, title: "Early, and it shows", body: "Join while the foundations are being laid. Your decisions will shape the product for years." },
  { icon: MapPin, title: "Impact you can see", body: `We're live in ${COVERAGE_COUNT} neighbourhoods across Lagos and Ibadan. Your work reaches real streets.` },
  { icon: Sparkles, title: "More than one product", body: "The neighbourhood app, myHoodora for Business and myHoodora AI, all under one roof." },
];

export default function CareersPage() {
  return (
    <MarketingPage>
      {/* ── Hero: copy + one strong team photo ────────────────────────────── */}
      <section className="bg-gradient-to-b from-canvas to-background">
        <div className={`${container} grid items-center gap-10 py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20`}>
          <div className="space-y-5 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
              <Briefcase className="size-3.5" aria-hidden /> Careers at myHoodora
            </p>
            <h1 className="text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">Help build stronger hoods across Nigeria</h1>
            <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground lg:mx-0">
              We&apos;re building the place where neighbours help each other, stay safe and grow together. Come build it with
              us, for the streets you live on.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="#roles"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
              >
                See open roles <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#talent"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 font-semibold transition-colors hover:bg-muted"
              >
                Join the talent network
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(20,124,115,0.5)]">
              <SmartImage
                fill
                priority
                quality={90}
                sizes="(min-width: 1024px) 580px, 100vw"
                className="object-cover"
                alt={CAREERS_IMAGE.alt}
                src={CAREERS_IMAGE.src}
              />
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl sm:left-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-coral text-white">
                <MapPin className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{COVERAGE_COUNT} neighbourhoods live</span>
                <span className="block text-sm text-muted-foreground">across Lagos &amp; Ibadan</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why join ────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-20">
        <ul className={`${container} grid gap-8 md:grid-cols-3`}>
          {WHY_NOW.map((w) => (
            <li key={w.title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral-ink">
                <w.icon className="size-5" aria-hidden />
              </span>
              <span>
                <h2 className="font-bold">{w.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Teams + open roles ──────────────────────────────────────────── */}
      <section id="roles" className="scroll-mt-20 bg-canvas py-16 lg:py-24">
        <div className={container}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold tracking-wide text-primary uppercase">Open roles</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Teams we&apos;re building</h2>
            </div>
            <p className="text-sm text-muted-foreground">Building for neighbours in Lagos, Ibadan and beyond.</p>
          </div>

          <ul className="mt-8 grid gap-x-8 gap-y-5 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
            {TEAMS.map((t) => {
              const count = OPEN_ROLES.filter((r) => r.team === t.title).length;
              return (
                <li key={t.title} className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <t.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 font-bold">
                      {t.title}
                      {count > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">{count} open</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{t.body}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8">{OPEN_ROLES.length > 0 ? <RoleList roles={OPEN_ROLES} /> : <NoRolesYet />}</div>
        </div>
      </section>

      {/* ── Talent network ──────────────────────────────────────────────── */}
      <section id="talent" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <div className="relative isolate mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="size-3.5" aria-hidden /> Talent network
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Don&apos;t see your role yet?</h2>
            <p className="text-lg text-primary-foreground/85">
              Tell us what you do best. When a role that fits opens, you&apos;ll hear from us first, before it&apos;s posted
              anywhere else.
            </p>
          </div>
          <TalentForm />
        </div>
      </section>

      <ExploreMore items={["about", "ai", "business"]} title="Get to know myHoodora" className="bg-canvas" />
    </MarketingPage>
  );
}

function NoRolesYet() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-card p-8 text-center sm:flex-row sm:text-left">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Briefcase className="size-7" aria-hidden />
      </span>
      <div className="flex-1">
        <p className="text-lg font-bold">No open roles right now</p>
        <p className="text-muted-foreground">We&apos;re growing. Join the talent network and you&apos;ll be first to know when we hire.</p>
      </div>
      <Link href="#talent" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90">
        Join the network <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function RoleList({ roles }: { roles: OpenRole[] }) {
  const teams = [...new Set(roles.map((r) => r.team))];
  return (
    <div className="space-y-8">
      {teams.map((team) => (
        <div key={team}>
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{team}</h3>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {roles
              .filter((r) => r.team === team)
              .map((r) => (
                <li key={r.id}>
                  <a href={r.applyUrl} className="group flex flex-col gap-2 p-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
                    <span className="flex-1 font-bold">{r.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.location} · {r.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary sm:ml-6">
                      Apply <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </span>
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
