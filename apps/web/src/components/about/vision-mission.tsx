"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section } from "@myhoodora/ui/section";
import { Kicker } from "@myhoodora/ui/kicker";

const STATS = [
  { value: "100%", label: "Address-verified members" },
  { value: "24/7", label: "Real-time local alerts" },
  { value: "0", label: "Anonymous accounts" },
];

/**
 * Vision + Mission — the "why we exist" brand statement, followed by the
 * human, Nigeria-grounded story and a short proof strip.
 */
export function VisionMissionSection() {
  return (
    <Section className="py-16 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Kicker>Our vision</Kicker>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Stronger hood, where neighbours are connected, informed, and always
            growing.
          </h2>
        </AnimatedSection>

        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:border-l lg:border-border lg:pl-16"
        >
          <Kicker>Our mission</Kicker>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            We exist to help neighbours stay connected to their community and to
            knowledge, building trusted Hoods where neighbours support one
            another, share what they know, and grow together.
          </p>
        </AnimatedSection>
      </div>

      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-12 max-w-3xl"
      >
        <p className="leading-relaxed text-muted-foreground">
          From Lagos to Kano, Enugu to Port Harcourt, we&apos;ve always found
          safety and opportunity through the people around us — the neighbour
          who keeps an eye on your gate, the market woman who vouches for you,
          the street association that settles a dispute before it escalates.
          myHoodora exists to give that everyday trust a home online — a
          verified, local space where neighbours share news, raise alarms, and
          support one another.
        </p>
      </AnimatedSection>

      {/* By the numbers */}
      <div className="mt-16 grid grid-cols-3 gap-6 border-t border-border pt-12">
        {STATS.map((stat, index) => (
          <AnimatedSection
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="text-center"
          >
            <div className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              {stat.value}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
