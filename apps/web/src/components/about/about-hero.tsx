"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Button } from "@myhoodora/ui/button";
import { ArrowRight, BellRing } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80&auto=format&fit=crop";

export function AboutHero() {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      <Image
        unoptimized
        fill
        priority
        alt="Aerial view of a city neighborhood at dusk"
        src={HERO_IMAGE}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/80" />

      <AnimatedSection
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-3xl px-6 py-24 text-center text-white lg:py-32"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          <BellRing className="size-3.5" />
          Why myHoodora exists
        </span>

        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          What if your whole{" "}
          <span className="text-brand-coral">street</span> looked out for you?
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85">
          myHoodora turns your neighborhood into a real-time network of
          verified neighbors — sharing security alerts, emergencies, and
          community news the moment they happen.
        </p>

        <div className="mt-8">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              <span>Get started for free</span>
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </AnimatedSection>
    </section>
  );
}
