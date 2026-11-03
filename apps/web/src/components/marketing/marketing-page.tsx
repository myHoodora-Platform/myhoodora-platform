import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/** Header + footer shell for public pages. */
export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Simple page heading band used by About, How it works, legal pages. */
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-gradient-to-b from-canvas to-background px-4 pt-14 pb-10 sm:px-6 lg:pt-20">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        {eyebrow && (
          <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="text-lg leading-relaxed text-muted-foreground">{description}</p>}
        {children}
      </div>
    </section>
  );
}
