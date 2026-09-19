"use client";

import { useEffect, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@myhoodora/ui/section";
import { Kicker } from "@myhoodora/ui/kicker";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Briefcase,
  Building2,
  Check,
  Code2,
  Mail,
  MessageCircle,
  Newspaper,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";

type IconComponent = ComponentType<{ className?: string }>;

interface FeatureMeta {
  title: string;
  description: string;
  icon: IconComponent;
}

const FEATURES: Record<string, FeatureMeta> = {
  careers: {
    title: "Careers",
    description:
      "We're assembling the team that will connect every neighborhood in Nigeria. Roles in engineering, community, and design are on the way.",
    icon: Briefcase,
  },
  press: {
    title: "Press",
    description:
      "Newsroom, media kit, and press contact are coming soon. For now, you can reach the team at hello@myhoodora.com.",
    icon: Newspaper,
  },
  contact: {
    title: "Contact",
    description:
      "A dedicated support and contact hub is on its way. In the meantime, email us at hello@myhoodora.com.",
    icon: MessageCircle,
  },
  verification: {
    title: "Neighbor Verification",
    description:
      "A step-by-step guide to our address-verification flow is being written — learn how we keep every hood full of real neighbors.",
    icon: BadgeCheck,
  },
  "safety-center": {
    title: "Safety Center",
    description:
      "Tools, resources, and emergency guidance to keep your neighborhood safe are coming together here.",
    icon: ShieldCheck,
  },
  "business-pages": {
    title: "Business Pages",
    description:
      "Claimable pages for the shops and services in your hood — coming soon to help local businesses thrive.",
    icon: Store,
  },
  api: {
    title: "Developer API",
    description:
      "A public API and developer portal are on the roadmap so you can build on top of your neighborhood graph.",
    icon: Code2,
  },
  marketplace: {
    title: "Marketplace",
    description:
      "Buy, sell, and discover nearby services from people and businesses around you.",
    icon: ShoppingBag,
  },
  "for-business": {
    title: "For Business",
    description:
      "Tools to help local businesses reach the neighbors around them — coming soon.",
    icon: Building2,
  },
};

const FALLBACK: FeatureMeta = {
  title: "Something new",
  description:
    "We're working on this part of myHoodora. Drop your email and we'll let you know the moment it's ready.",
  icon: Sparkles,
};

/** Placeholder launch date — update before going live. */
const LAUNCH_TARGET = "2026-12-01T00:00:00";

function useCountdown(target: string) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return [
    { value: days, label: "Days" },
    { value: hours, label: "Hours" },
    { value: minutes, label: "Minutes" },
    { value: seconds, label: "Seconds" },
  ];
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function ComingSoonPage({ feature }: { feature: string }) {
  const meta = FEATURES[feature] ?? FALLBACK;
  const Icon = meta.icon;
  const countdown = useCountdown(LAUNCH_TARGET);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const onNotify = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubscribed(true);
    toast.success("You're on the list — we'll be in touch!");
  };

  return (
    <div className="flex min-h-screen flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1">
        <Section className="py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="mt-10 inline-flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm">
                <Icon className="size-8" />
              </div>

              <Kicker className="mt-8" icon={BellRing}>
                Coming soon
              </Kicker>

              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                {meta.title} is on its way
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {meta.description}
              </p>
            </motion.div>

            {countdown && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="mx-auto mt-10 grid w-full max-w-md grid-cols-4 gap-3"
              >
                {countdown.map((unit) => (
                  <div
                    key={unit.label}
                    className="rounded-2xl border border-border bg-card px-2 py-3"
                  >
                    <div className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                      {pad(unit.value)}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mx-auto mt-8 w-full max-w-md"
            >
              <AnimatePresence mode="wait">
                {subscribed ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-6 py-4 text-sm font-semibold text-primary"
                  >
                    <Check className="size-4" />
                    You&apos;re on the list! We&apos;ll email you at {email}.
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={onNotify}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-3 sm:flex-row"
                  >
                    <label className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                    >
                      Notify me
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 text-xs text-muted-foreground/70"
            >
              myHoodora — connecting neighbors, one hood at a time.
            </motion.p>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
