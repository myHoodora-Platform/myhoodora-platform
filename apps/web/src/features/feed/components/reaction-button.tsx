"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ThumbsUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@myhoodora/ui/popover";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import type { Post, ReactionType } from "@/lib/api/types";
import { REACTIONS, reactionDef } from "../categories";

interface ReactionButtonProps {
  post: Post;
  onReact: (post: Post, type: ReactionType | null) => Promise<unknown>;
}

/**
 * Tap = Like / remove your reaction. The caret opens the full set
 * (Like · Helpful · Agree · Haha · Wow · Sad). Click-driven rather than
 * hover-driven so it works identically on touch and mouse.
 */
export function ReactionButton({ post, onReact }: ReactionButtonProps) {
  const { runGatedAction } = useAuth();
  const [open, setOpen] = useState(false);
  const mine = post.myReaction ? reactionDef(post.myReaction) : null;

  const react = (type: ReactionType | null) => {
    setOpen(false);
    runGatedAction(() => {
      onReact(post, type).catch(() => toast.error("Couldn't update your reaction."));
    });
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => react(mine ? null : "like")}
        aria-pressed={!!mine}
        className={cn(
          "flex h-10 items-center gap-2 rounded-l-full pr-1 pl-3 text-sm font-semibold transition-colors hover:bg-muted",
          mine ? "text-primary" : "text-muted-foreground",
        )}
      >
        {mine ? (
          <span aria-hidden className="text-base leading-none">{mine.emoji}</span>
        ) : (
          <ThumbsUp className="size-[18px]" aria-hidden />
        )}
        {mine ? mine.label : "Like"}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Choose a reaction"
            className="flex h-10 w-8 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronDown className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="flex gap-1 rounded-full p-1.5">
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => react(r.id)}
              aria-label={r.label}
              title={r.label}
              className={cn(
                "flex size-11 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
                post.myReaction === r.id && "bg-primary/10",
              )}
            >
              <span aria-hidden>{r.emoji}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
