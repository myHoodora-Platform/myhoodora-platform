import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AboutHero } from "./about-hero";
import { AboutStory } from "./about-story";
import { NeighborhoodNetwork } from "./neighborhood-network";
import { HowItWorksSection } from "./how-it-works";
import { TrustSafetySection } from "./trust-safety";

/**
 * Combined "About Us" + "How It Works" page, served at both `/about` and
 * `/how-it-works`. The two routes share this one composition so the content
 * stays in sync.
 *
 * Flow: hook (hero) → mission & values → the neighborhood network → how it
 * works → trust & safety.
 */
export function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1">
        <AboutHero />
        <AboutStory />
        <NeighborhoodNetwork />
        <HowItWorksSection />
        <TrustSafetySection />
      </main>
      <Footer />
    </div>
  );
}
