"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getPollResults, unvotePoll, votePoll } from "@/lib/api/polls";
import { pluralize, timeLeft } from "@/lib/format";
import type { PollResults, Post } from "@/lib/api/types";

/**
 * One anonymous vote per neighbour. Options are buttons until you vote;
 * then everyone sees result bars. While the poll is open you can tap your
 * choice again to remove your vote, or tap another option to switch.
 */
export function PollCard({ post }: { post: Post }) {
  const { user, runGatedAction } = useAuth();
  const poll = post.meta.poll;
  const [results, setResults] = useState<PollResults | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (user && poll) void getPollResults(user, post).then(setResults).catch(() => undefined);
    // Results only need loading once per post.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, post._id]);

  if (!poll) return null;
  const closed = results?.closed ?? false;
  const showResults = !!results && (results.myVote !== null || closed);

  const choose = (optionId: string) =>
    runGatedAction(async () => {
      if (!user || !results || closed) return;
      const removing = results.myVote === optionId;
      setBusy(optionId);
      try {
        setResults(removing ? await unvotePoll(user, post) : await votePoll(user, post, optionId));
        if (removing) toast("Vote removed.", { id: `poll-${post._id}`, duration: 2000 });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't update your vote."));
      } finally {
        setBusy(null);
      }
    });

  const leader = results && results.total > 0 ? Math.max(...Object.values(results.counts)) : -1;

  return (
    <div className="space-y-2" role="group" aria-label="Poll">
      {poll.options.map((option) => {
        const count = results?.counts[option.id] ?? 0;
        const pct = results && results.total > 0 ? Math.round((count / results.total) * 100) : 0;
        const mine = results?.myVote === option.id;

        if (!showResults) {
          return (
            <button
              key={option.id}
              type="button"
              disabled={!results || busy !== null}
              onClick={() => choose(option.id)}
              className={cn(
                "flex min-h-11 w-full items-center rounded-xl border border-primary/40 px-4 py-2 text-left text-[15px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60",
                busy === option.id && "bg-primary/10",
              )}
            >
              {option.text}
            </button>
          );
        }

        const label = closed
          ? undefined
          : mine
            ? `${option.text}, your vote. Tap to remove your vote`
            : `${option.text}. Tap to change your vote to this`;

        return (
          <button
            key={option.id}
            type="button"
            disabled={closed || busy !== null}
            aria-pressed={mine}
            aria-label={label}
            onClick={() => choose(option.id)}
            className={cn(
              "relative flex min-h-11 w-full items-center justify-between overflow-hidden rounded-xl border px-4 py-2 text-left text-[15px] transition-colors disabled:cursor-default",
              mine ? "border-primary/50" : "border-border",
              !closed && "hover:border-primary/50",
              busy === option.id && "opacity-70",
            )}
          >
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 transition-[width] duration-500", mine ? "bg-primary/20" : "bg-muted")}
              style={{ width: `${pct}%` }}
            />
            <span className={cn("relative flex items-center gap-2", (mine || (closed && count === leader)) && "font-bold")}>
              {option.text}
              {mine && <CheckCircle2 className="size-4 text-primary" aria-hidden />}
            </span>
            <span className="relative font-semibold">{pct}%</span>
          </button>
        );
      })}
      <p className="text-[13px] text-muted-foreground">
        {results ? pluralize(results.total, "vote") : "…"} · {closed ? "Final results" : timeLeft(poll.closesAt)}
        {results?.myVote && !closed ? " · Tap your choice to remove it, or another option to switch" : " · Votes are anonymous"}
      </p>
    </div>
  );
}
