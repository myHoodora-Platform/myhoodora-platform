import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  GraduationCap,
  Landmark,
  Megaphone,
  Scissors,
  ShoppingBasket,
  Store,
  ThumbsUp,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BusinessPageScreen, BusinessPostScreen, RecommendationScreen, SponsoredScreen } from "@/components/marketing/business-screens";
import { IPhoneMockup, PhoneStage } from "@/components/marketing/iphone-mockup";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { ExploreMore } from "@/components/marketing/explore-more";
import { BUSINESS_IMAGE } from "@/lib/site-images";

export const metadata: Metadata = {
  title: "myHoodora for Business | Reach neighbours near you",
  description:
    "Create a free Business Page, post to nearby neighbours and earn recommendations from verified residents in Lagos and Ibadan.",
};

const START = "/business/get-started";

function Cta({ children, href = START, variant = "solid" }: { children: React.ReactNode; href?: string; variant?: "solid" | "light" | "outline" }) {
  return (
    <Link
      href={href}
      className={
        variant === "light"
          ? "inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 font-bold text-[#14201e] transition-colors hover:bg-white/90"
          : variant === "outline"
            ? "inline-flex h-12 items-center gap-2 rounded-full border border-white/50 px-6 font-semibold text-white transition-colors hover:bg-white/10"
            : "inline-flex h-12 items-center gap-2 rounded-full bg-[#14201e] px-7 font-bold text-white transition-colors hover:bg-[#14201e]/90"
      }
    >
      {children}
    </Link>
  );
}

/** Alternating copy + phone rows (Nextdoor Business pattern). */
const FEATURES: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  cta: string;
  screen: React.ReactNode;
  label: string;
  soon?: boolean;
}[] = [
  {
    eyebrow: "Business Posts",
    title: "Get the word out with free Business Posts",
    body: "Share offers, new stock, opening hours or events straight into the neighbourhood feed, the most-viewed part of myHoodora.",
    points: ["Free to post", "Choose which neighbourhoods see it", "Neighbours react, comment and message you"],
    cta: "Create your free Business Page",
    screen: <BusinessPostScreen />,
    label: "A Business Post from Mama Tee's Kitchen in the Lekki Phase 1 feed",
  },
  {
    eyebrow: "Recommendations",
    title: "Be the business neighbours recommend",
    body: "When someone asks “who knows a good electrician?”, neighbours can recommend you by name. Every recommendation comes from a verified resident.",
    points: ["Recommendations can't be bought, only earned", "Your count shows on every post", "Word of mouth, now online"],
    cta: "Start earning recommendations",
    screen: <RecommendationScreen />,
    label: "Neighbours recommending Femi Electricals in a thread",
  },
  {
    eyebrow: "Business Page",
    title: "A free shopfront your neighbours can find",
    body: "Your Business Page shows your services, the areas you cover, your hours and what neighbours say about you, with buttons to message or call.",
    points: ["Verified business badge", "Show the areas you serve", "Private messages, no need to share your number"],
    cta: "Claim your free Business Page",
    screen: <BusinessPageScreen />,
    label: "The Business Page for Femi Electricals",
  },
  {
    eyebrow: "Local Ads · Coming soon",
    title: "Reach more neighbours with Local Ads",
    body: "Promote an offer to the exact neighbourhoods you serve, with a clear daily budget in naira. We'll let you know when Local Ads launch.",
    points: ["Target by neighbourhood", "Budgets that suit small businesses", "Simple results you can understand"],
    cta: "Join the waitlist",
    screen: <SponsoredScreen />,
    label: "A sponsored Local Ad for an AC servicing business",
    soon: true,
  },
];

const WHO: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Wrench, title: "Artisans & home services", body: "Electricians, plumbers, generator and AC repair, painters, cleaners" },
  { icon: Utensils, title: "Food & catering", body: "Restaurants, bukas, home cooks, bakers and event caterers" },
  { icon: ShoppingBasket, title: "Shops & supermarkets", body: "Provision stores, pharmacies, boutiques and phone shops" },
  { icon: Scissors, title: "Beauty & wellness", body: "Salons, barbers, spas, tailors and fitness trainers" },
  { icon: GraduationCap, title: "Schools & tutors", body: "Schools, crèches, lesson teachers and music classes" },
  { icon: Building2, title: "Property & facilities", body: "Estate agents, facility managers and property developers" },
];

const STEPS = [
  { title: "Create your page", body: "Tell us your business name, what you do and the neighbourhoods you serve. It's free." },
  { title: "Get verified", body: "Confirm your phone number, and your CAC number if you're registered. Sole traders and artisans are welcome." },
  { title: "Post and get recommended", body: "Share updates with nearby neighbours and collect recommendations from happy customers." },
];

const FAQS = [
  { q: "Is it really free?", a: "Yes. Your Business Page and Business Posts are free. Local Ads will be an optional paid extra when they launch." },
  { q: "Do I need to be CAC registered?", a: "No. Sole traders, artisans and home businesses are welcome. If you're registered, add your CAC number to get verified faster." },
  { q: "Which areas can I reach?", a: "Any of the neighbourhoods where we're live in Lagos and Ibadan. You choose the ones you serve, and neighbours there will see your posts." },
  { q: "Can I pay for recommendations?", a: "No. Recommendations only come from verified residents, which is exactly why neighbours trust them." },
  { q: "Can estates and residents' associations join?", a: "Yes. Estate managers and residents' associations get an official page with a verified badge, announcements and urgent alerts to every resident." },
];

export default function BusinessPage() {
  return (
    <MarketingPage>
      {/* Hero: fixed skyline behind the copy (parallax on large screens; iOS falls back to scroll). */}
      <section
        className="relative isolate overflow-hidden bg-cover bg-center lg:bg-fixed"
        style={{ backgroundImage: `url(${BUSINESS_IMAGE.src})` }}
        role="img"
        aria-label={BUSINESS_IMAGE.alt}
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1716]/95 via-[#0b1716]/75 to-[#0b1716]/35" />
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center gap-6 px-4 py-20 text-white sm:px-6 lg:px-8">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur">
            <Store className="size-3.5" aria-hidden /> myHoodora for Business
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Grow your business with the neighbours around you
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/85">
            Reach verified residents in Lagos and Ibadan with a free Business Page, free posts to nearby neighbourhoods, and
            recommendations from people who&apos;ve actually used you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Cta variant="light">
              Create your free Business Page <ArrowRight className="size-4" aria-hidden />
            </Cta>
            <Cta href="#how" variant="outline">
              How it works
            </Cta>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-white/85">
            {["Free to start", "Verified local customers", "No CAC needed to begin"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-[#7fd6cb]" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why neighbours */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            [BadgeCheck, "Real, verified customers", "Every neighbour on myHoodora has confirmed where they live. No bots, no strangers from across the country."],
            [ThumbsUp, "Trust that travels", "In Nigeria, business runs on referrals. myHoodora puts word of mouth where the whole neighbourhood can see it."],
            [Megaphone, "Local by design", "Reach the estates and streets you actually serve, not people you can't deliver to."],
          ].map(([Icon, title, body]) => {
            const I = Icon as LucideIcon;
            return (
              <div key={title as string} className="rounded-2xl border border-border bg-card p-6">
                <I className="size-7 text-primary" aria-hidden />
                <h2 className="mt-3 text-lg font-bold">{title as string}</h2>
                <p className="mt-1 text-muted-foreground">{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature rows with phones */}
      <section className="bg-canvas px-4 py-8 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-6xl divide-y divide-border">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
              <div className={`space-y-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                <p className="text-sm font-bold tracking-wide text-primary uppercase">{f.eyebrow}</p>
                <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{f.title}</h2>
                <p className="text-lg leading-relaxed text-muted-foreground">{f.body}</p>
                <ul className="space-y-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 font-medium">
                      <Check className="size-5 shrink-0 text-primary" aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
                <Cta href={f.soon ? `${START}?interest=ads` : START}>
                  {f.cta} <ArrowRight className="size-4" aria-hidden />
                </Cta>
              </div>
              <div className={`flex justify-center ${i % 2 === 1 ? "pb-6 lg:order-1" : ""}`}>
                {/* Alternate: sliced phone on a shelf, then a full standing phone. */}
                {i % 2 === 0 ? (
                  <PhoneStage tone={i === 0 ? "primary" : "coral"}>
                    <IPhoneMockup crop={0.72} className="w-[250px] sm:w-[290px]" label={f.label}>
                      {f.screen}
                    </IPhoneMockup>
                  </PhoneStage>
                ) : (
                  <IPhoneMockup className="w-[260px] sm:w-[290px]" label={f.label}>
                    {f.screen}
                  </IPhoneMockup>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Made for Nigerian local businesses</h2>
            <p className="text-lg text-muted-foreground">If your customers live nearby, myHoodora is for you.</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHO.map((w) => (
              <li key={w.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <w.icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{w.title}</span>
                  <span className="block text-sm text-muted-foreground">{w.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How to get started */}
      <section id="how" className="scroll-mt-20 bg-canvas px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Get started in three steps</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Cta>
              Create your free Business Page <ArrowRight className="size-4" aria-hidden />
            </Cta>
          </div>
        </div>
      </section>

      {/* Estates & associations */}
      <section id="estates" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              <Landmark className="size-3.5" aria-hidden /> Estates, associations &amp; agencies
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Reach every resident, not just the ones in the WhatsApp group</h2>
            <p className="text-lg text-primary-foreground/85">
              Estate managers, residents&apos; associations and public bodies (LGAs, police divisions, DisCos) can run an
              official page to share announcements, send urgent alerts and run polls with verified residents only.
            </p>
            <a
              href="mailto:hello@myhoodora.com?subject=Official%20page%20for%20our%20estate"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-primary transition-colors hover:bg-white/90"
            >
              Talk to us about an official page <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <ul className="space-y-3">
            {["Official verified badge", "Urgent alerts to every resident", "Anonymous polls for decisions", "Events and meetings with RSVPs"].map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-semibold">
                <BadgeCheck className="size-5 shrink-0" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-canvas px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Business questions</h2>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold marker:hidden">
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA over the same fixed skyline */}
      <section className="relative isolate overflow-hidden bg-cover bg-center lg:bg-fixed" style={{ backgroundImage: `url(${BUSINESS_IMAGE.src})` }}>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#0b1716]/80" />
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-20 text-center text-white sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Become your neighbourhood&apos;s go-to business</h2>
          <p className="text-lg text-white/85">Free Business Page. Free posts. Real neighbours.</p>
          <Cta variant="light">
            Create your free Business Page <ArrowRight className="size-4" aria-hidden />
          </Cta>
        </div>
      </section>

      <ExploreMore items={["how-it-works", "safety", "ai"]} title="More from myHoodora" />
    </MarketingPage>
  );
}
