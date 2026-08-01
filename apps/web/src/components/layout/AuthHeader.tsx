"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoFull } from "@myhoodora/ui/logo";
import { Button } from "@myhoodora/ui/button";

export function AuthHeader() {
  const pathname = usePathname();

  return (
    <header className="w-full flex items-center justify-between px-6 lg:px-20 py-4 border-b border-primary/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        <Link href="/">
          <LogoFull size="md" />
        </Link>
        <div>
          {pathname === "/login" && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                New to myHoodora?
              </span>
              <Link href="/register">
                <Button variant="outline" size="sm">
                  Sign up
                </Button>
              </Link>
            </div>
          )}
          {pathname === "/register" && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Already have an account?
              </span>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Log in
                </Button>
              </Link>
            </div>
          )}
          {pathname === "/forgot-password" && (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Back to Log in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
