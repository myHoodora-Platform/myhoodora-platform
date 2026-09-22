"use client";

import type { ReactNode } from "react";
import { showComingSoon } from "@/lib/coming-soon";
import { cn } from "@myhoodora/ui/utils";

interface ComingSoonLinkProps {
  /** Shown in the toast, e.g. "Terms of Service is coming soon". */
  feature?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Looks like a link, but shows a "coming soon" toast instead of navigating.
 * Use it for links whose page doesn't exist yet, so nobody lands on a 404 or
 * loses what they typed into a form.
 */
export function ComingSoonLink({ feature, className, children }: ComingSoonLinkProps) {
  return (
    <button type="button" onClick={() => showComingSoon(feature)} className={cn("cursor-pointer text-left", className)}>
      {children}
    </button>
  );
}
