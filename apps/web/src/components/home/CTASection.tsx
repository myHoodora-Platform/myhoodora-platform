"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Button } from "@myhoodora/ui/button";
import { ArrowRight, Users } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 sm:py-20 px-6 lg:px-20">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl bg-slate-900 text-white p-8 sm:p-12 lg:p-16 border border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Subtle background glow accents matching brand colors */}
          <div className="absolute -top-24 -right-24 size-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-semibold text-primary-foreground/90">
              <Users className="size-3.5 text-primary" />
              <span>Join Your Neighborhood</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Ready to meet your neighbors?
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Join thousands of neighbors already using myHoodora to build
              stronger, safer, and more connected communities.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2 font-bold text-base px-8 py-6 rounded-xl shadow-lg">
                  <span>Get started for free</span>
                  <ArrowRight className="size-5" />
                </Button>
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
