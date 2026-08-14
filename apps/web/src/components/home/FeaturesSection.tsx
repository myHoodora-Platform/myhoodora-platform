"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { ShieldCheck, BellRing, Star } from "lucide-react";

export function FeaturesSection() {
  return (
    <Section className="bg-muted/30 py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <SectionHeading
          title="Everything you need to stay connected"
          description="myHoodora brings the best of your neighborhood to your fingertips, ensuring you're always in the loop."
        />
      </AnimatedSection>

      <div className="grid md:grid-cols-3 gap-12">
        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center text-center group p-8 rounded-2xl hover:bg-primary/5 transition-all"
        >
          <div className="size-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck className="size-10" />
          </div>
          <h3 className="text-xl font-bold mb-4">A secure environment</h3>
          <p className="text-muted-foreground leading-relaxed">
            Every member is verified with their home address, ensuring your
            digital neighborhood is as safe as your physical one.
          </p>
        </AnimatedSection>

        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center text-center group p-8 rounded-2xl hover:bg-primary/5 transition-all"
        >
          <div className="size-20 bg-brand-coral/10 text-brand-coral rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <BellRing className="size-10" />
          </div>
          <h3 className="text-xl font-bold mb-4">
            Stay informed with alerts
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Get real-time updates on safety issues, missing pets, or local
            emergencies directly from people living on your street.
          </p>
        </AnimatedSection>

        <AnimatedSection
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center text-center group p-8 rounded-2xl hover:bg-primary/5 transition-all"
        >
          <div className="size-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Star className="size-10" />
          </div>
          <h3 className="text-xl font-bold mb-4">Discover local favorites</h3>
          <p className="text-muted-foreground leading-relaxed">
            Find the best plumber, reliable babysitters, or hidden gems in
            your area recommended by neighbors you can trust.
          </p>
        </AnimatedSection>
      </div>
    </Section>
  );
}
