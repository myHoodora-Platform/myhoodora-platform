"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { AlertTriangle, ShieldCheck } from "lucide-react";

const SCENARIOS = [
  "Security alerts",
  "Emergencies",
  "Missing persons",
  "Flooding & power",
  "Community watch",
];

export function WhyItMatters() {
  return (
    <Section className="py-20 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-14"
      >
        <SectionHeading
          kicker="Why we built this"
          title="Because bad news shouldn't reach you last"
          description="In neighborhoods across Nigeria, insecurity, emergencies, and everyday hazards often spread through rumors and delayed word-of-mouth."
        />
      </AnimatedSection>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* The problem */}
        <AnimatedSection
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-slate-300 sm:p-10"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <AlertTriangle className="size-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              The problem
            </span>
          </div>
          <h3 className="mt-5 text-2xl font-bold text-white">
            By the time word gets around, it&apos;s often too late.
          </h3>
          <p className="mt-3 leading-relaxed">
            Security incidents, road hazards, flooding, and power outages are
            usually reported after the fact — through rumors that are slow,
            incomplete, and hard to trust. You find out when it&apos;s already on
            your doorstep.
          </p>
        </AnimatedSection>

        {/* The promise */}
        <AnimatedSection
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-primary p-8 text-white shadow-xl shadow-primary/20 sm:p-10"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <ShieldCheck className="size-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              The promise
            </span>
          </div>
          <h3 className="mt-5 text-2xl font-bold text-white">
            Real-time alerts from the people on your street.
          </h3>
          <p className="mt-3 leading-relaxed text-white/90">
            myHoodora turns your neighborhood into a watchful network of
            verified neighbors sharing updates the moment they happen — so you
            can stay safe, informed, and one step ahead.
          </p>
        </AnimatedSection>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
        {SCENARIOS.map((scenario) => (
          <span
            key={scenario}
            className="rounded-full border border-border bg-white px-4 py-1.5 text-sm font-semibold text-muted-foreground"
          >
            {scenario}
          </span>
        ))}
      </div>
    </Section>
  );
}
