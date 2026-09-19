"use client";

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { MapPin } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Input } from "@myhoodora/ui/input";
import { SmartImage } from "@myhoodora/ui/image";
import { HERO_IMAGE } from "@/lib/site-images";
import { HeroAuthCard } from "./hero-auth-card";

function HeroCopy() {
  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight leading-tight text-foreground sm:text-5xl lg:text-6xl">
        Discover your <br />
        <span className="text-primary">neighborhood</span>
      </h1>
      <p className="text-base text-muted-foreground max-w-lg leading-relaxed sm:text-lg lg:text-xl">
        Connect with neighbors, get real-time alerts, and build a safer,
        friendlier place to live.
      </p>
    </>
  );
}

export function HeroSection() {
  const objectPosition = HERO_IMAGE.mobile?.position ?? HERO_IMAGE.position;
  const mobileAspect = (HERO_IMAGE.mobile?.aspectRatio ?? "16/9").replace(
    "/",
    " / ",
  );

  return (
    <section className="relative overflow-hidden">
      {/* Full-bleed image + left gradient — desktop only */}
      <div className="absolute inset-0 z-0 hidden lg:block">
        <SmartImage
          fill
          priority
          className="object-cover"
          style={objectPosition ? { objectPosition } : undefined}
          alt={HERO_IMAGE.alt}
          src={HERO_IMAGE.src}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
        <a
          href={HERO_IMAGE.creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-4 z-10 rounded-md bg-black/25 px-2 py-0.5 text-[11px] text-white/60 backdrop-blur-sm transition-colors hover:text-white/90"
        >
          Photo: {HERO_IMAGE.credit}
        </a>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop (lg+): copy + address form | auth card */}
        <div className="hidden min-h-[85vh] items-center gap-12 py-12 lg:grid lg:grid-cols-2">
          <AnimatedSection
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
          >
            <HeroCopy />
            <div className="flex flex-col gap-4 max-w-md pt-4 sm:flex-row">
              <div className="relative flex-1 group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors size-5" />
                <Input
                  className="pl-12 pr-4"
                  placeholder="Enter your address"
                  type="text"
                />
              </div>
              <Button size="lg" className="whitespace-nowrap">
                Find my hood
              </Button>
            </div>
          </AnimatedSection>

          <AnimatedSection
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HeroAuthCard className="ml-auto max-w-md" />
          </AnimatedSection>
        </div>

        {/* Mobile (< lg): copy → contained image card → auth card */}
        <div className="flex flex-col gap-8 py-10 lg:hidden">
          <AnimatedSection
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-5"
          >
            <HeroCopy />
          </AnimatedSection>

          <div
            className="relative overflow-hidden rounded-3xl border border-border shadow-lg"
            style={{ aspectRatio: mobileAspect }}
          >
            <SmartImage
              fill
              priority
              className="object-cover"
              style={objectPosition ? { objectPosition } : undefined}
              alt={HERO_IMAGE.alt}
              src={HERO_IMAGE.src}
            />
            <a
              href={HERO_IMAGE.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-3 z-10 rounded-md bg-black/25 px-2 py-0.5 text-[11px] text-white/60 backdrop-blur-sm transition-colors hover:text-white/90"
            >
              Photo: {HERO_IMAGE.credit}
            </a>
          </div>

          <HeroAuthCard />
        </div>
      </div>
    </section>
  );
}
