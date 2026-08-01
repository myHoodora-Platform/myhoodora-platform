import Link from "next/link";
import { LogoFull } from "@myhoodora/ui/logo";
import { HeaderActions } from "./HeaderActions";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-md px-6 lg:px-20 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <Link href="/">
          <LogoFull size="md" />
        </Link>
        <nav className="hidden md:flex flex-1 justify-center gap-8">
          <Link
            className="text-sm font-semibold hover:text-primary transition-colors"
            href="/how-it-works"
          >
            How It Works
          </Link>
          <Link
            className="text-sm font-semibold hover:text-primary transition-colors"
            href="/marketplace"
          >
            Marketplace
          </Link>
          <Link
            className="text-sm font-semibold hover:text-primary transition-colors"
            href="/for-business"
          >
            For Business
          </Link>
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}
