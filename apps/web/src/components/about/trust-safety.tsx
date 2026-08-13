"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { Button } from "@myhoodora/ui/button";
import { CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

const POINTS = [
  "Your exact address is never shown publicly — only your neighborhood.",
  "You choose what you share, and with whom.",
  "Every neighbor is address-verified, so you're talking to real people — not anonymous accounts.",
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
              title="Your address stays yours — always"
              description="We understand how much your privacy matters. In Nigeria, your home is your safe place, and where you live is nobody's business but yours and your neighbors'. That's why we never post your exact address or share it with strangers."
            />
            <ul className="mt-8 space-y-4">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/privacy">
                <Button variant="outline" className="gap-2">
                  How we protect your data
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link
                href="/guidelines"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Read our Community Guidelines
              </Link>
            </div>
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
