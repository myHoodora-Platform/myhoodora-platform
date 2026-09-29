import type { Metadata } from "next";
import Link from "next/link";
import { SmartImage } from "@myhoodora/ui/image";
import { ArrowUpRight, BookOpen, Mail, MessageCircle, Newspaper, Phone, Store, type LucideIcon } from "lucide-react";
import { ExploreMore } from "@/components/marketing/explore-more";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { ContactForm } from "@/features/company/contact-form";
import { isContactTopic } from "@/lib/api/company";
import { CONTACT_IMAGE } from "@/lib/site-images";

export const metadata: Metadata = {
  title: "Contact us | myHoodora",
  description: "Questions, feedback, press or partnerships: get in touch with the myHoodora team.",
};

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const SHORTCUTS: { icon: LucideIcon; title: string; body: string; href: string; cta: string }[] = [
  { icon: BookOpen, title: "Help centre", body: "Answers about your account, verification, alerts and more.", href: "/help", cta: "Browse help" },
  { icon: Store, title: "Business Pages", body: "Put your business or estate on myHoodora for free.", href: "/business/get-started", cta: "Get started" },
  { icon: Newspaper, title: "Press & media", body: "Fast facts, logos and product imagery.", href: "/press", cta: "Visit newsroom" },
];

const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/myhoodora" },
  { label: "Facebook", href: "https://www.facebook.com/people/MyHoodora/61574388514329/" },
  { label: "Instagram", href: "https://www.instagram.com/myhoodora/" },
  { label: "X", href: "https://x.com/myHoodora" },
];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;

  return (
    <MarketingPage>
      {/* ── Hero: neighbours laughing together, teal wash for legibility ─── */}
      <section className="relative isolate overflow-hidden text-white">
        <SmartImage
          fill
          priority
          quality={90}
          className="-z-10 object-cover"
          style={{ objectPosition: CONTACT_IMAGE.position }}
          alt={CONTACT_IMAGE.alt}
          src={CONTACT_IMAGE.src}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b3d38]/95 via-[#0f5f58]/80 to-[#147c73]/20" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-black/25 to-transparent" />
        <div className={`${container} flex min-h-[520px] items-center py-20 lg:min-h-[600px]`}>
          <div className="max-w-xl space-y-6 text-center sm:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur">
              <MessageCircle className="size-3.5" aria-hidden /> Contact us
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">How can we help?</h1>
            <p className="text-lg text-white/90">
              Questions, feedback, press or partnerships, we&apos;d love to hear from you. Neighbours already on myHoodora
              can get help fastest right inside the app.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="#message"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 font-bold text-primary shadow-lg hover:bg-white/90"
              >
                <Mail className="size-4" aria-hidden /> Send us a message
              </Link>
              <Link
                href="/help"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/50 px-6 font-semibold backdrop-blur-sm hover:bg-white/10"
              >
                Open the Help centre
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Shortcuts ───────────────────────────────────────────────────── */}
      <section className="py-12 lg:py-16">
        <ul className={`${container} grid gap-4 md:grid-cols-3`}>
          {SHORTCUTS.map((s) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="group flex h-full items-start gap-4 rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{s.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.body}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
                    {s.cta} <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Form + direct channels ──────────────────────────────────────── */}
      <section id="message" className="scroll-mt-20 bg-canvas py-16 lg:py-24">
        <div className={`${container} grid gap-8 lg:grid-cols-[1.5fr_1fr]`}>
          <ContactForm initialTopic={isContactTopic(topic) ? topic : undefined} />

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6">
              <Mail className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">Email us</h2>
              <p className="mt-1 text-sm text-muted-foreground">Prefer your own email app? Write to us directly.</p>
              <a href="mailto:hello@myhoodora.com" className="mt-3 inline-block font-bold text-primary hover:underline">
                hello@myhoodora.com
              </a>
            </div>

            <div className="rounded-3xl border border-destructive/25 bg-danger-soft/50 p-6">
              <Phone className="size-6 text-destructive" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">In an emergency</h2>
              <p className="mt-1 text-sm text-foreground/80">
                myHoodora isn&apos;t an emergency service. If someone is in danger, call <strong>112</strong> first, then
                alert your neighbours.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">Follow myHoodora</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {SOCIALS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <ExploreMore items={["safety", "how-it-works", "about"]} />
    </MarketingPage>
  );
}
