"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Button } from "@myhoodora/ui/button";
import { Section } from "@myhoodora/ui/section";
import {
  ArrowRight,
  ShieldCheck,
  BellRing,
  MessageSquare,
} from "lucide-react";

interface LiveAlert {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  text: string;
  time: string;
}

const LIVE_ALERTS: LiveAlert[] = [
  { icon: ShieldCheck, text: "Security alert — Ogun Street", time: "2 min ago" },
  { icon: BellRing, text: "Flood warning — Marina axis", time: "24 min ago" },
  { icon: MessageSquare, text: "Power restored — Phase 2", time: "1 hr ago" },
];

export function AboutHero() {
  return (
    <Section className="relative overflow-hidden pb-20 pt-16 lg:pb-28 lg:pt-24">
      <div className="pointer-events-none absolute -top-32 right-0 size-[28rem] rounded-full bg-primary/5 blur-3xl" />

      <div className="relative grid items-center gap-12 lg:grid-cols-2">
        {/* Why narrative */}
        <AnimatedSection
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <BellRing className="size-3.5" />
            Why myHoodora exists
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            What if your whole{" "}
            <span className="text-primary">street</span> looked out for you?
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            myHoodora turns your neighborhood into a real-time network of
            verified neighbors — sharing security alerts, emergencies, and
            community news the moment they happen, so you&apos;re never the last
            to know what&apos;s going on around you.
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                <span>Get started for free</span>
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Join neighbors already watching out for each other.
            </p>
          </div>
        </AnimatedSection>

        {/* Live alert mock */}
        <AnimatedSection
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="rounded-3xl border border-border bg-white p-6 shadow-2xl shadow-primary/10">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-sm font-bold text-foreground">
                  Live · Your neighborhood
                </span>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                Verified
              </span>
            </div>

            <ul className="mt-2 divide-y divide-border">
              {LIVE_ALERTS.map((alert) => (
                <li key={alert.text} className="flex items-start gap-3 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <alert.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {alert.text}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {alert.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-1 rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
              Real-time updates from verified neighbors on your street.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </Section>
  );
}
