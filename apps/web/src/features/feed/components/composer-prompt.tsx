"use client";

import { AlertTriangle, CalendarDays, ImagePlus, ThumbsUp } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { useComposer } from "../composer-context";

const QUICK = [
  { category: "recommendation", label: "Recommend", icon: ThumbsUp },
  { category: "alert", label: "Alert", icon: AlertTriangle },
  { category: "event", label: "Event", icon: CalendarDays },
] as const;

/** Top-of-feed entry point: "What's happening, neighbour?" (Nextdoor pattern). */
export function ComposerPrompt() {
  const viewer = useViewer();
  const { openComposer } = useComposer();
  const me = viewer.user ? resolveAuthor(viewer.user.uid, viewer) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-3">
        {me && <UserAvatar person={me} />}
        <button
          type="button"
          onClick={() => openComposer("general")}
          className="h-11 flex-1 rounded-full bg-muted px-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-muted/70"
        >
          What&apos;s happening, neighbour?
        </button>
        <button
          type="button"
          onClick={() => openComposer("general")}
          aria-label="Post a photo"
          className="flex size-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
        >
          <ImagePlus className="size-5" />
        </button>
      </div>
      <div className="mt-2 flex gap-1 border-t border-border pt-2">
        {QUICK.map((q) => (
          <button
            key={q.category}
            type="button"
            onClick={() => openComposer(q.category)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <q.icon className="size-4" aria-hidden />
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
