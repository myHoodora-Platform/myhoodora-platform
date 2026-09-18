"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

interface SettingsListRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
}

export function SettingsListRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  trailing,
  destructive,
}: SettingsListRowProps) {
  const isInteractive = Boolean(href || onClick);
  const content = (
    <>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            destructive ? "text-destructive" : "text-slate-800",
          )}
        >
          {label}
        </p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {trailing ?? (href && <ChevronRight className="size-4 shrink-0 text-slate-300" />)}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
    isInteractive && "hover:bg-slate-50",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
