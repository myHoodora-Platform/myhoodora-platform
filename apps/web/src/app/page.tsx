import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GoogleOneTap } from "@/components/shared/google-one-tap";
import { RedirectIfSignedIn } from "@/components/shared/redirect-if-signed-in";
import { BusinessTeaser, Faq, Features, FinalCta, Hero, PhoneShowcase, SafetyTeaser, Steps } from "@/components/marketing/landing";

export const metadata: Metadata = publicPageMetadata("/", {
  title: "myHoodora — Your neighbourhood, connected",
  description: "myHoodora connects neighbours to share updates, stay informed, and support local businesses in their community.",
});

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <RedirectIfSignedIn />
      <GoogleOneTap />
      <Header />
      <main className="flex-1">
        <Hero />
        <PhoneShowcase />
        <Features />
        <Steps />
        <SafetyTeaser />
        <BusinessTeaser />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
