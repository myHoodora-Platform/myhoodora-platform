import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AboutHero } from "./about-hero";
import { WhyItMatters } from "./why-it-matters";
import { HowItWorksSection } from "./how-it-works";
import { AboutStory } from "./about-story";
import { TrustSafetySection } from "./trust-safety";

/**
 * Combined "About Us" + "How It Works" page, served at both `/about` and
 * `/how-it-works`. The two routes share this one composition so the content
 * stays in sync.
 *
 * Flow: hook (hero) → why it matters → how it works → mission & values →
 * trust & safety.
 */
export function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1">
        <AboutHero />
        <WhyItMatters />
        <HowItWorksSection />
        <AboutStory />
        <TrustSafetySection />
      </main>
      <Footer />
    </div>
  );
}
