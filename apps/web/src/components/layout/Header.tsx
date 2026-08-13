"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoFull } from "@myhoodora/ui/logo";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { Menu, X } from "lucide-react";
import { HeaderActions } from "./HeaderActions";

interface NavLink {
  label: string;
  href: string;
}

const MARKETING_NAV: NavLink[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "For Business", href: "/for-business" },
];

interface AuthCta {
  hint?: string;
  label: string;
  href: string;
  variant: "outline" | "ghost";
}

const AUTH_CTA: Record<string, AuthCta> = {
  "/login": {
    hint: "New to myHoodora?",
    label: "Sign up",
    href: "/register",
    variant: "outline",
  },
  "/register": {
    hint: "Already have an account?",
    label: "Log in",
    href: "/login",
    variant: "outline",
  },
  "/forgot-password": {
    label: "Back to Log in",
    href: "/login",
    variant: "ghost",
  },
  "/reset-password": {
    label: "Back to Log in",
    href: "/login",
    variant: "ghost",
  },
};

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const authCta = AUTH_CTA[pathname];

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="myHoodora home">
          <LogoFull size="md" />
        </Link>

        {authCta ? (
          <div className="flex items-center gap-3">
            {authCta.hint && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {authCta.hint}
              </span>
            )}
            <Link href={authCta.href}>
              <Button variant={authCta.variant} size="sm">
                {authCta.label}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop navigation */}
            <nav
              aria-label="Main"
              className="hidden items-center gap-1 md:flex"
            >
              {MARKETING_NAV.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                      isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <HeaderActions className="hidden md:flex" />
              <button
                type="button"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-muted md:hidden"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {!authCta && mobileOpen && (
        <div className="absolute inset-x-0 top-full border-b border-primary/10 bg-background shadow-lg animate-fade-in-down md:hidden">
          <nav aria-label="Main" className="flex flex-col gap-1 px-4 py-3">
            {MARKETING_NAV.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-primary/10 px-4 py-3">
            <HeaderActions layout="stack" />
          </div>
        </div>
      )}
    </header>
  );
}
