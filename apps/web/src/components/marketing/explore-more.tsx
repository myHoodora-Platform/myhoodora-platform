import Link from "next/link";
import { ArrowUpRight, BookOpen, Building2, Compass, Heart, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

export type ExploreKey = "about" | "how-it-works" | "safety" | "business" | "guidelines";

interface ExploreItem {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** Card surface: tinted panel colours for the icon block. */
  tone: string;
  iconTone: string;
  /** Little chips previewing what's on the page (shown on the larger 2-up cards). */
  preview: string[];
}

const ITEMS: Record<ExploreKey, ExploreItem> = {
  about: {
    href: "/about",
    eyebrow: "About us",
    title: "Why we're building stronger hoods",
    body: "Our vision, our mission and the HOOD values that shape every feature.",
    icon: Heart,
    tone: "bg-brand-coral/10",
    iconTone: "bg-brand-coral text-white",
    preview: ["Our vision", "Our mission", "HOOD values"],
  },
  "how-it-works": {
    href: "/how-it-works",
    eyebrow: "How it works",
    title: "From sign-up to your first post",
    body: "Join, confirm your neighbourhood and see everything that's inside.",
    icon: Compass,
    tone: "bg-primary/10",
    iconTone: "bg-primary text-primary-foreground",
    preview: ["1 · Sign up", "2 · Confirm your hood", "3 · Say hello"],
  },
  safety: {
    href: "/safety",
    eyebrow: "Safety & trust",
    title: "How we keep your hood safe",
    body: "Verified neighbours, a private address, kindness reminders and 112 first.",
    icon: ShieldCheck,
    tone: "bg-slate-900/[0.06] dark:bg-white/10",
    iconTone: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    preview: ["✓ Verified neighbours", "🔒 Private address", "📞 112 first"],
  },
  business: {
    href: "/business",
    eyebrow: "For business & estates",
    title: "Reach neighbours around the corner",
    body: "A free Business Page for local businesses, and official pages for estates.",
    icon: Building2,
    tone: "bg-primary/10",
    iconTone: "bg-primary text-primary-foreground",
    preview: ["Free Business Page", "Neighbour recommendations", "Estate pages"],
  },
  guidelines: {
    href: "/guidelines",
    eyebrow: "Community guidelines",
    title: "Be a good neighbour",
    body: "The simple rules that keep conversations helpful, kind and local.",
    icon: BookOpen,
    tone: "bg-brand-coral/10",
    iconTone: "bg-brand-coral text-white",
    preview: ["Be kind", "Keep it local", "No scams"],
  },
};

/**
 * "Keep exploring" band shown just above the footer on public pages, so
 * visitors can jump between About, How it works, Safety and Business
 * without going back to the nav.
 */
export function ExploreMore({
  items,
  title = "Keep exploring myHoodora",
  className,
}: {
  items: ExploreKey[];
  title?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby="explore-more" className={cn("px-4 py-16 sm:px-6 lg:py-20", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="explore-more" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <Link href="/register" className="text-sm font-semibold text-primary hover:underline">
            Ready already? Join free →
          </Link>
        </div>
        <ul className={cn("mt-8 grid gap-4", items.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {items.map((key) => {
            const it = ITEMS[key];
            return (
              <li key={key}>
                <Link
                  href={it.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_48px_-24px_rgba(20,124,115,0.45)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className={cn("relative flex items-end overflow-hidden px-6 pb-5", items.length >= 3 ? "h-32" : "h-40 sm:h-48", it.tone)}>
                    {/* Decorative rings */}
                    <span aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full border-[18px] border-current opacity-[0.06]" />
                    {items.length < 3 && (
                      <span aria-hidden className="absolute right-5 bottom-5 hidden flex-col items-end gap-2 sm:flex">
                        {it.preview.map((p, n) => (
                          <span
                            key={p}
                            className={cn(
                              "rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-transform duration-300",
                              n === 0 && "group-hover:-translate-x-1",
                              n === 1 && "-rotate-2 group-hover:-translate-x-2",
                              n === 2 && "rotate-1 group-hover:-translate-x-3",
                            )}
                          >
                            {p}
                          </span>
                        ))}
                      </span>
                    )}
                    <span
                      className={cn(
                        "flex size-14 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
                        it.iconTone,
                      )}
                    >
                      <it.icon className="size-7" aria-hidden />
                    </span>
                    <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-6">
                    <p className="text-xs font-bold tracking-wide text-primary uppercase">{it.eyebrow}</p>
                    <h3 className="text-xl font-bold tracking-tight">{it.title}</h3>
                    <p className="text-muted-foreground">{it.body}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
