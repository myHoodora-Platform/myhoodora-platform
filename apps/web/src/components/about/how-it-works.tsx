"use client";

import type { ComponentType, SVGProps } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { MapPin, MessageSquare, Users } from "lucide-react";

interface Step {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: MapPin,
    title: "Verify your address",
    description:
      "Join with your real address to unlock your actual neighborhood — no anonymous accounts, just verified neighbors you can trust.",
  },
  {
    icon: MessageSquare,
    title: "Connect with neighbors",
    description:
      "Share updates, ask for recommendations, and join conversations on your neighborhood feed and safety watch groups.",
  },
  {
    icon: Users,
    title: "Participate & thrive",
    description:
      "RSVP to local events, buy and sell on the marketplace, and support the businesses that make your community unique.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" className="py-16 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <SectionHeading
          kicker="How it works"
          title="From your address to your community in three steps"
          description="Getting started is simple — and every step is designed to keep your neighborhood real, local, and safe."
        />
      </AnimatedSection>

      <div className="relative">
        {/* Connecting line (desktop) */}
        <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-gradient-to-r from-transparent via-border to-transparent md:block" />

        <div className="grid gap-12 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <AnimatedSection
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 flex size-16 items-center justify-center rounded-full border-2 border-primary bg-white text-xl font-bold text-primary">
                {index + 1}
              </div>
              <div className="mt-6 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </Section>
  );
}
