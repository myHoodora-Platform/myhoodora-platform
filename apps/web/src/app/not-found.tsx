import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { MascotLockup } from "@myhoodora/ui/logo";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BackButton } from "@/components/shared/BackButton";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-background">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center space-y-8">
        <div className="space-y-6 flex flex-col items-center max-w-lg mx-auto">
          <MascotLockup size="lg" className="mb-4" />

          <h1 className="text-7xl lg:text-9xl font-bold text-foreground tracking-tight drop-shadow-sm">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Looks like you&apos;re lost in the neighbourhood
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
            The page you are looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back to familiar streets.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 w-full max-w-md">
            <BackButton className="w-full" />

            <Link href="/" className="w-full">
              <Button className="w-full">
                <Home className="size-5" />
                Return Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
