import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RedirectIfSignedIn } from "@/components/shared/redirect-if-signed-in";
import { BusinessTeaser, Faq, Features, FinalCta, Hero, PhoneShowcase, SafetyTeaser, Steps } from "@/components/marketing/landing";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <RedirectIfSignedIn />
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
