"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Section, SectionHeading } from "@myhoodora/ui/section";

interface HoodValue {
  letter: string;
  word: string;
  description: string;
}

const HOOD_VALUES: HoodValue[] = [
  {
    letter: "H",
    word: "Help",
    description:
      "Make it easy for neighbours to lend a hand and lift each other up, whatever form that help takes.",
  },
  {
    letter: "O",
    word: "Openness",
    description:
      "Keep information and knowledge flowing freely, so every neighbour has access to what they need to know.",
  },
  {
    letter: "O",
    word: "Ownership",
    description:
      "Put neighbours in charge of their own wellbeing and growth — trusted, self-sustaining, and built on accountability.",
  },
  {
    letter: "D",
    word: "Discovery",
    description:
      "Help neighbours discover what's around them and what's worth knowing — the people, places, and ideas that make their world bigger.",
  },
];

/**
 * The HOOD values — Help, Openness, Ownership, Discovery — rendered as a
 * scannable letter + word + description grid.
 */
export function HoodValuesSection() {
  return (
    <Section className="py-16 lg:py-24">
      <AnimatedSection
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-14"
      >
        <SectionHeading
          kicker="The HOOD values"
          title="What HOOD stands for"
          description="Four values shape how we build myHoodora — and how neighbours show up for one another."
        />
      </AnimatedSection>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {HOOD_VALUES.map((value, index) => (
          <AnimatedSection
            key={value.word}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="rounded-2xl border border-border bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                {value.letter}
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {value.word}
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {value.description}
            </p>
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
