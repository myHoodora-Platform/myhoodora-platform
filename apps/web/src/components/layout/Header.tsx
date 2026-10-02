"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { ChevronDown, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { HeaderActions } from "./HeaderActions";

interface NavLink {
  label: string;
  href: string;
  description?: string;
  /** Shows a small "Soon" pill for features that aren't live yet. */
  soon?: boolean;
}

/** "About" groups the pages that explain myHoodora itself. */
const ABOUT_LINKS: NavLink[] = [
  { label: "About us", href: "/about", description: "Our vision, mission and HOOD values" },
  { label: "How it works", href: "/how-it-works", description: "Joining, verifying and what's inside" },
  { label: "Safety & trust", href: "/safety", description: "How we keep neighbourhoods safe" },
];

const MARKETING_NAV: NavLink[] = [
  { label: "For business", href: "/business" },
  { label: "Marketplace", href: "/coming-soon/marketplace", soon: true },
];

const ALL_MOBILE_LINKS: NavLink[] = [...ABOUT_LINKS, ...MARKETING_NAV];

function SoonBadge() {
  return (
    <span className="rounded-full bg-brand-coral/15 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-brand-coral-ink uppercase">
      Soon
    </span>
  );
}

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
          <MascotWordmark size="md" />
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-muted/60 data-[state=open]:text-foreground",
                    ABOUT_LINKS.some((l) => l.href === pathname) && "bg-primary/10 text-primary",
                  )}
                >
                  About
                  <ChevronDown className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-2">
                  {ABOUT_LINKS.map((item) => (
                    <DropdownMenuItem key={item.href} asChild className="flex-col items-start gap-0.5 rounded-lg px-3 py-2.5">
                      <Link href={item.href}>
                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{item.description}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {MARKETING_NAV.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                      isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {item.label}
                    {item.soon && <SoonBadge />}
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
            {ALL_MOBILE_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  {item.label}
                  {item.soon && <SoonBadge />}
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
