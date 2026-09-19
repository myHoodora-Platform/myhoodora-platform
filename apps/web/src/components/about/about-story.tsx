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
      "From the compound to the city, looking out for one another is how we've always survived — and thrived.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & safety",
    description:
      "Your address stays yours. Neighbors are verified without your exact location ever being made public.",
  },
  {
    icon: Star,
    title: "Local empowerment",
    description:
      "From the corner shop to the town market, we lift up the businesses and voices that hold the community together.",
  },
];

const STATS = [
  { value: "100%", label: "Address-verified members" },
  { value: "24/7", label: "Real-time local alerts" },
  { value: "0", label: "Anonymous accounts" },
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
            kicker="Our mission & purpose"
            title="Bringing the 'we' back to the neighborhood"
            description="Nigeria's strength has always been its communities — the compound, the street, the town union. myHoodora brings that same closeness online, so the neighbors you already trust can look out for one another in real time."
          />
          <p className="mt-6 leading-relaxed text-muted-foreground">
            From Lagos to Kano, Enugu to Port Harcourt, we&apos;ve always found
            safety and opportunity through the people around us — the neighbor
            who keeps an eye on your gate, the market woman who vouches for you,
            the street association that settles a dispute before it escalates.
            myHoodora exists to give that everyday trust a home online: a
            verified, local space where your neighborhood can share news, raise
            alarms, and support one another before trouble ever reaches your
            door.
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
                <h3 className="text-base font-semibold text-foreground">
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
