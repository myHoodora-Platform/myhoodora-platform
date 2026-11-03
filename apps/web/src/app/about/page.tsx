import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, HeartHandshake, Home, ShieldCheck, Users } from "lucide-react";
import { SmartImage } from "@myhoodora/ui/image";
import { MarketingPage, PageIntro } from "@/components/marketing/marketing-page";
import { ExploreMore } from "@/components/marketing/explore-more";
import { ABOUT_IMAGE } from "@/lib/site-images";

export const metadata: Metadata = publicPageMetadata("/about", {
  title: "About myHoodora",
  description: "Stronger hoods, where neighbours are connected, informed and always growing. Our vision, mission and HOOD values.",
});

/** Objectives, one per letter of HOOD. */
const HOOD_VALUES = [
  {
    letter: "H",
    title: "Help",
    icon: HeartHandshake,
    body: "Make it easy for neighbours to lend a hand and lift each other up, whatever form that help takes.",
  },
  {
    letter: "O",
    title: "Openness",
    icon: BookOpen,
    body: "Keep information and knowledge flowing freely, so every neighbour has access to what they need to know.",
  },
  {
    letter: "O",
    title: "Ownership",
    icon: ShieldCheck,
    body: "Put neighbours in charge of their own wellbeing and growth: trusted, self-sustaining, and built on accountability.",
  },
  {
    letter: "D",
    title: "Discovery",
    icon: Compass,
    body: "Help neighbours discover what's around them and what's worth knowing: the people, places and ideas that make their world bigger.",
  },
];

export default function AboutPage() {
  return (
    <MarketingPage>
      <PageIntro
        eyebrow="About myHoodora"
        title="Building better neighbourhoods across Nigeria"
        description="We believe the people on your street are your first line of support. myHoodora makes it easy to find them, trust them and look out for each other."
      />

      <section className="px-4 sm:px-6">
        <div className="relative mx-auto aspect-[21/9] max-w-6xl overflow-hidden rounded-3xl border border-border">
          <SmartImage fill priority quality={90} sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" alt={ABOUT_IMAGE.alt} src={ABOUT_IMAGE.src} />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Why we started</h2>
            <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
              <p>
                In most Nigerian neighbourhoods, important news travels through a patchwork of WhatsApp groups, gate
                notices and word of mouth. A security alert gets buried under forwarded messages. Newcomers never get
                added. And you can&apos;t always tell who&apos;s actually a neighbour.
              </p>
              <p>
                myHoodora brings it together in one trusted place. Everyone is a verified resident, alerts reach
                the whole neighbourhood, and finding a reliable electrician or a good lesson teacher is one question
                away.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <Users className="size-8 text-brand-coral" aria-hidden />
              <h3 className="mt-4 text-lg font-bold">Our vision</h3>
              <p className="mt-1.5 text-muted-foreground">
                Stronger hoods, where neighbours are connected, informed and always growing.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <Home className="size-8 text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-bold">Our mission</h3>
              <p className="mt-1.5 text-muted-foreground">
                We exist to help neighbours stay connected to their community and to knowledge, building trusted
                Hoods where neighbours support one another, share what they know, and grow together.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="hood-values" className="bg-canvas px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
              Our objectives
            </p>
            <h2 id="hood-values" className="text-3xl font-bold tracking-tight sm:text-4xl">
              What makes a{" "}
              <span aria-label="HOOD" className="text-primary">
                H<span className="text-brand-coral">O</span>O<span className="text-brand-coral">D</span>
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">Four values guide everything we build.</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOOD_VALUES.map((v, i) => (
              <li key={v.title} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
                <span
                  aria-hidden
                  className={`absolute -top-3 -right-1 text-8xl leading-none font-bold ${i % 2 === 0 ? "text-primary/10" : "text-brand-coral/15"}`}
                >
                  {v.letter}
                </span>
                <span
                  className={`relative flex size-12 items-center justify-center rounded-2xl text-xl font-bold text-white ${i % 2 === 0 ? "bg-primary" : "bg-brand-coral"}`}
                  aria-hidden
                >
                  {v.letter}
                </span>
                <h3 className="relative mt-4 flex items-center gap-2 text-lg font-bold">
                  <v.icon className="size-5 text-primary" aria-hidden />
                  {v.title}
                </h3>
                <p className="relative mt-1.5 leading-relaxed text-muted-foreground">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl space-y-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Starting in Lagos and Ibadan</h2>
          <p className="text-lg text-muted-foreground">
            We&apos;re live in 22 neighbourhoods across Lagos and Ibadan, with more cities on the way. Want myHoodora
            for your estate, or to work with us? We&apos;d love to hear from you.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90">
              Join myHoodora <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-border px-6 font-semibold hover:bg-muted">
              Contact us
            </Link>
          </div>
        </div>
      </section>

      <ExploreMore items={["how-it-works", "safety"]} title="See how myHoodora works for you" className="bg-canvas" />
    </MarketingPage>
  );
}
