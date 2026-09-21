"use client";

import type { ComponentType, SVGProps } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { cn } from "@myhoodora/ui/utils";
import {
  MessageSquare,
  ShieldCheck,
  HelpCircle,
  ShoppingBag,
  Calendar,
} from "lucide-react";

interface Feature {
  tag: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  tint: string;
  featured?: boolean;
}

const FEATURES: Feature[] = [
  {
    tag: "News",
    icon: MessageSquare,
    title: "Neighbourhood Feed",
    description:
      "Know the stories shaping your street — from a new shop opening to the school team's big win, see what your neighbours are talking about.",
    tint: "bg-primary/10 text-primary",
    featured: true,
  },
  {
    tag: "Alerts",
    icon: ShieldCheck,
    title: "Safety Watch Group",
    description:
      "Stay safe and prepared with real-time alerts on security issues, emergencies, and hazards near you.",
    tint: "bg-brand-coral/10 text-brand-coral",
  },
  {
    tag: "Ask",
    icon: HelpCircle,
    title: "Ask Your Neighbours",
    description:
      "Discover the hidden gems your neighbours love — the best schools, plumbers, and weekend spots.",
    tint: "bg-amber-500/10 text-amber-600",
  },
  {
    tag: "For Sale & Free",
    icon: ShoppingBag,
    title: "Marketplace Listings",
    description:
      "Find neighbourhood treasures — declutter, sell your old bike, or pick up something free from a neighbour.",
    tint: "bg-sky-500/10 text-sky-600",
  },
  {
    tag: "Events & Groups",
    icon: Calendar,
    title: "Community Events",
    description:
      "Turn shared interests into real-life connections — from a pickup game to a street-wide garage sale.",
    tint: "bg-emerald-500/10 text-emerald-600",
  },
];

export function NeighborhoodNetwork() {
  return (
    <Section className="bg-muted/30 py-16 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-14"
      >
        <SectionHeading
          kicker="Your essential neighbourhood network"
          title="The place for what's happening in your neighbourhood"
          description="Trusted, timely, useful information that helps you stay in the know — and share what you know. Here's how:"
        />
      </AnimatedSection>

      <div className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <AnimatedSection
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className={cn(
              "group relative rounded-2xl border border-border bg-white p-5 sm:p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
              feature.featured && "md:col-span-2",
            )}
          >
            <div className="flex items-start justify-between">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110",
                  feature.tint,
                )}
              >
                <feature.icon className="size-6" />
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  feature.tint,
                )}
              >
                {feature.tag}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {feature.description}
            </p>

            {feature.featured && (
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Live updates from your street
              </div>
            )}
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
