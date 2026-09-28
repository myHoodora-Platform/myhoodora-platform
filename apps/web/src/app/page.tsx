import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CommunityFeedSection } from "@/components/home/CommunityFeedSection";
import { CTASection } from "@/components/home/CTASection";
import { RedirectIfSignedIn } from "@/components/shared/redirect-if-signed-in";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <RedirectIfSignedIn />
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <CommunityFeedSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
