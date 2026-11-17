"use client";

import { useEffect, useState } from "react";
import type { ConversationStarter } from "@myhoodora/api-contract/hood-content";
import { MessageCircleHeart } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { getStarters } from "@/lib/api/hood-content";
import type { PostCategory } from "@/lib/api/types";
import { useComposer } from "../composer-context";

const LABEL: Record<string, string> = { S01: "Introduce yourself" };

/** A starter's chip label: its own name, or its first words. */
function chipLabel(s: ConversationStarter): string {
  if (LABEL[s.code]) return LABEL[s.code]!;
  const plain = s.text.replace(/^[^\p{L}\p{N}]+/u, "");
  const first = plain.split(/(?<=[?.!])\s/)[0] ?? plain;
  return first.length > 42 ? `${first.slice(0, 40).trimEnd()}…` : first;
}

/**
 * "Not sure what to say?": tappable conversation starters from the Hood Team's content bank that open
 * the composer with the text in, for neighbours to make their own. Shown while a Hood is still quiet.
 */
export function StarterChips({ className, title = "Not sure what to say? Start with one of these" }: { className?: string; title?: string }) {
  const { user } = useAuth();
  const { openComposer } = useComposer();
  const [starters, setStarters] = useState<ConversationStarter[]>([]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    getStarters(user)
      .then((s) => live && setStarters(s))
      .catch(() => undefined); // Nice to have: the feed works without them.
    return () => {
      live = false;
    };
  }, [user]);

  if (!starters.length) return null;
  return (
    <section aria-label="Conversation starters" className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <MessageCircleHeart className="size-4 text-primary" aria-hidden /> {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {starters.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => openComposer(s.category as PostCategory, s.text)}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
          >
            {chipLabel(s)}
          </button>
        ))}
      </div>
    </section>
  );
}
