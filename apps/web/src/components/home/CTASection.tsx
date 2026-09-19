"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section } from "@myhoodora/ui/section";
import { Button } from "@myhoodora/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <Section className="py-24 sm:py-32">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Connect with your neighbors
        </h2>

        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          A private, secure place for your street — verified neighbors, local
          alerts, and trusted recommendations. Free to join.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="gap-2 px-8">
              Join myHoodora
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link
            href="/coming-soon/business-pages"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Have a business? Create a page
          </Link>
        </div>
      </AnimatedSection>
    </Section>
  );
}
