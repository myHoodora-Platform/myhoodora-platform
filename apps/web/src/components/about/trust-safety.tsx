"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { Button } from "@myhoodora/ui/button";
import { SmartImage } from "@myhoodora/ui/image";
import { CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { TRUST_IMAGE } from "@/lib/site-images";

const POINTS = [
  "Your exact address is never shown publicly — only your neighborhood.",
  "You choose what you share, and with whom.",
  "Every neighbor is address-verified, so you're talking to real people — not anonymous accounts.",
];

export function TrustSafetySection() {
  return (
    <Section className="py-16 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-brand-coral/15 bg-gradient-to-br from-brand-coral/5 to-transparent p-8 sm:p-12 lg:p-16"
      >
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              kicker="Trust & safety"
              kickerClassName="bg-brand-coral/10 text-brand-coral"
              title="Your address stays yours — always"
              description="We understand how much your privacy matters. In Nigeria, your home is your safe place, and where you live is nobody's business but yours and your neighbors'. That's why we never post your exact address or share it with strangers."
            />
            <ul className="mt-8 space-y-4">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-coral" />
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

          <div>
            <div className="relative">
              <SmartImage
                src={TRUST_IMAGE.src}
                alt={TRUST_IMAGE.alt}
                width={800}
                height={600}
                sizes="(min-width: 1024px) 480px, 100vw"
                className="aspect-[4/3] w-full rounded-3xl border border-border object-cover shadow-xl"
              />
              <div className="absolute -bottom-5 left-6 flex items-center gap-2.5 rounded-2xl border border-border bg-white px-4 py-3 shadow-lg">
                <ShieldCheck className="size-5 shrink-0 text-brand-coral" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Address-verified
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Real neighbors, real trust
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-8 text-[11px] text-muted-foreground/70">
              Photo:{" "}
              <a
                href={TRUST_IMAGE.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {TRUST_IMAGE.credit}
              </a>
            </p>
          </div>
        </div>
      </AnimatedSection>
    </Section>
  );
}
