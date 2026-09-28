"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Goes back in history when there is some, otherwise to `fallback`. */
export function BackLink({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex h-10 items-center gap-2 rounded-full pr-3 pl-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted"
    >
      <ArrowLeft className="size-5" aria-hidden />
      {label}
    </button>
  );
}
