"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { CheckCircle2, ShieldCheck } from "lucide-react";

const POINTS = [
  "Every member verifies their real address before joining.",
  "Neighbors are real people, not anonymous accounts.",
  "Communities are moderated to keep conversations constructive.",
];

export function TrustSafetySection() {
  return (
    <Section className="py-20 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-8 sm:p-12 lg:p-16"
      >
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              kicker="Trust & safety"
              title="Your real neighborhood, verified"
              description="We take safety seriously because real communities are built on trust."
            />
            <ul className="mt-8 space-y-4">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="flex size-40 items-center justify-center rounded-full border-2 border-dashed border-primary/30 bg-white text-primary shadow-sm sm:size-48">
              <ShieldCheck className="size-20 sm:size-24" />
            </div>
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}
