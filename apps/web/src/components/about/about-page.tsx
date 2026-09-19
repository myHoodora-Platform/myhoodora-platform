import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AboutHero } from "./about-hero";
import { VisionMissionSection } from "./vision-mission";
import { HoodValuesSection } from "./hood-values";
import { NeighborhoodNetwork } from "./neighborhood-network";
import { HowItWorksSection } from "./how-it-works";
import { TrustSafetySection } from "./trust-safety";

/**
 * Combined "About Us" + "How It Works" page, served at both `/about` and
 * `/how-it-works`. The two routes share this one composition so the content
 * stays in sync.
 *
 * Flow: hook (hero) → vision & mission → HOOD values → the neighborhood
 * network → how it works → trust & safety.
 */
export function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1">
        <AboutHero />
        <VisionMissionSection />
        <HoodValuesSection />
        <NeighborhoodNetwork />
        <HowItWorksSection />
        <TrustSafetySection />
      </main>
      <Footer />
    </div>
  );
}
