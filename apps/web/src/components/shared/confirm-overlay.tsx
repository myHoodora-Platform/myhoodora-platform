"use client";

import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";

interface ConfirmOverlayProps {
  icon: LucideIcon;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmOverlay({
  icon: Icon,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      <div className="relative z-10 w-full max-w-md animate-in rounded-2xl border border-slate-100 bg-white p-6 shadow-xl duration-200 zoom-in-95">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col items-center space-y-4 pt-2 text-center">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight text-slate-800">
              {title}
            </h3>
            <p className="px-2 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            className={cn(destructive && "bg-destructive hover:bg-destructive/90")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
