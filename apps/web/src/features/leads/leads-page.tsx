"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Gavel, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { invalidateLeadStatus, useLeadStatus } from "@/hooks/use-lead-status";
import { errorMessage } from "@/lib/api/client";
import { getLeadQueue, voteOnCase, type LeadCase, type LeadVote } from "@/lib/api/moderation";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  misinformation: "Misinformation",
  scam: "Scam",
  not_local: "Not about the neighbourhood",
  other: "Something else",
};

const VOTES: { id: LeadVote; label: string; hint: string }[] = [
  { id: "keep", label: "Keep", hint: "It's within the guidelines" },
  { id: "maybe_remove", label: "Not sure", hint: "Borderline" },
  { id: "remove", label: "Remove", hint: "It breaks the guidelines" },
];

/** Readable text for any reported item. */
function contentText(c: LeadCase): { title: string; body: string } {
  const k = c.content as Record<string, unknown>;
  if (k.kind === "post") return { title: "Post", body: String(k.message ?? c.target.preview) };
  if (k.kind === "comment") return { title: "Comment", body: String(k.message ?? c.target.preview) };
  if (k.kind === "listing") return { title: `Listing · ${String(k.title ?? "")}`, body: String(k.description ?? c.target.preview) };
  if (k.kind === "group") return { title: `Group · ${String(k.name ?? "")}`, body: String(k.description ?? c.target.preview) };
  return { title: c.target.type, body: c.target.preview };
}

function hoursLeft(iso: string): string {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return h <= 1 ? "less than an hour left" : `${h} hours left`;
}

/**
 * Hood Lead review queue (Nextdoor model): volunteers vote on reported
 * content in their own neighbourhood. Three votes with a two-thirds majority
 * decide; otherwise the myHoodora team takes over after 48 hours. Leads never
 * see who reported, and never vote on their own content.
 */
export function LeadsPage() {
  const { user } = useAuth();
  const status = useLeadStatus();
  const [cases, setCases] = useState<LeadCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setError(null);
    getLeadQueue(user)
      .then(setCases)
      .catch((err) => setError(errorMessage(err, "Couldn't load reports.")));
  }, [user]);

  useEffect(() => {
    if (status?.isLead) load();
  }, [status?.isLead, load]);

  const vote = async (c: LeadCase, v: LeadVote) => {
    if (!user) return;
    setBusy(c.id);
    try {
      const res = await voteOnCase(user, c.id, v);
      invalidateLeadStatus();
      if (res.decided) {
        toast.success("Thanks. Leads reached a decision on this one.");
        setCases((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
      } else {
        setCases((prev) => prev?.map((x) => (x.id === c.id ? { ...x, myVote: v, votes: x.myVote ? x.votes : x.votes + 1 } : x)) ?? null);
        toast.success("Vote recorded");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't record your vote."));
      load();
    } finally {
      setBusy(null);
    }
  };

  if (status && !status.isLead) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={ShieldCheck} title="Hood Leads only" description="Hood Leads are volunteer neighbours who help review reports. The myHoodora team appoints them." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Hood Lead reviews" description="Reports from your neighbourhood waiting for your vote." />

      <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
        <Gavel className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-foreground/80">
          Judge each item against the{" "}
          <Link href={ROUTES.guidelines} className="font-semibold text-primary underline-offset-2 hover:underline">
            community guidelines
          </Link>
          , not whether you agree with it. Three votes with a two-thirds majority decide; if Leads can&apos;t agree within 48 hours, our team decides. You never see who
          reported it.
        </p>
      </div>

      {error ? (
        <ErrorState title="Couldn't load reports" message={error} onRetry={load} />
      ) : cases === null ? (
        <div className="space-y-3" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="All caught up" description="There are no reports waiting in your neighbourhood. Thank you for looking out for your neighbours." />
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => {
            const text = contentText(c);
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 capitalize text-foreground">{text.title}</span>
                  {c.reasons.map((r) => (
                    <span key={r.reason} className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      {r.count > 1 && ` ×${r.count}`}
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {hoursLeft(c.closesAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{text.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  First reported {timeAgo(c.firstReportedAt)} · {c.votes} {c.votes === 1 ? "vote" : "votes"} so far
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Your vote">
                  {VOTES.map((v) => {
                    const mine = c.myVote === v.id;
                    return (
                      <Button
                        key={v.id}
                        type="button"
                        variant={mine ? "default" : "outline"}
                        disabled={busy === c.id}
                        aria-pressed={mine}
                        title={v.hint}
                        onClick={() => void vote(c, v.id)}
                        className={cn(v.id === "remove" && !mine && "text-destructive hover:text-destructive")}
                      >
                        {v.label}
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
