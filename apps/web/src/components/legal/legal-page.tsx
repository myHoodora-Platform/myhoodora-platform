import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Section } from "@myhoodora/ui/section";

interface LegalPageProps {
  title: string;
  updatedAt: string;
  intro?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for legal / policy pages (Privacy Policy, Community
 * Guidelines, Terms, …): a centered prose column under the standard
 * header and footer.
 */
export function LegalPage({ title, updatedAt, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1">
        <Section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {updatedAt}
            </p>
            {intro && (
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                {intro}
              </p>
            )}
            <div className="mt-10 space-y-10">{children}</div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

/** A titled block of prose within a legal page. */
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
