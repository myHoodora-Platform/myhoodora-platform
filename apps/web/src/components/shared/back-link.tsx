"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

export interface BackLinkProps {
  fallback: string;
  href?: string;
  label?: string;
  className?: string;
}

export function BackLink({ href, fallback, label = "Back", className }: BackLinkProps) {
  const destination = href ?? fallback;
  return (
    <Link
      href={destination}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full pr-3 pl-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted",
        className,
      )}
    >
      <ArrowLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
