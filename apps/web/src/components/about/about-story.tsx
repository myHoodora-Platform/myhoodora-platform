"use client";

import type { ComponentType, SVGProps } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";
import { Users, ShieldCheck, Star } from "lucide-react";

interface Value {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const VALUES: Value[] = [
  {
    icon: Users,
    title: "Community first",
    description:
      "We believe the people closest to you are your greatest resource.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & safety",
    description:
      "Every member is address-verified, so your neighborhood stays as safe as your street.",
  },
  {
    icon: Star,
    title: "Local empowerment",
    description:
      "We help local voices, events, and businesses thrive right where they are.",
  },
];

export function AboutStory() {
  return (
    <Section className="py-20 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <AnimatedSection
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeading
            align="left"
            kicker="Our mission"
            title="Stronger communities start with knowing your neighbors"
            description="myHoodora was built on a simple idea: the best way to make a neighborhood safer, friendlier, and more vibrant is to help the people in it talk to one another."
          />
          <p className="mt-6 leading-relaxed text-muted-foreground">
            When neighbors know each other, they look out for each other. They
            share a lost pet alert before a flyer goes up, recommend the
            plumber who actually showed up on time, and organize the clean-up
            that turns a park into a gathering place. myHoodora exists to make
            those small connections easy — so every street feels like a
            community.
          </p>
        </AnimatedSection>

        <div className="grid gap-4">
          {VALUES.map((value, index) => (
            <AnimatedSection
              key={value.title}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex items-start gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <value.icon className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {value.title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </Section>
  );
}
