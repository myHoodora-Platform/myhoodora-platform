"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { Field, fieldInputClass } from "@/components/shared/field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { fileAppeal, getMyDecisions, type MyDecision, type ModerationActionType } from "@/lib/api/moderation";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import { SettingsSection } from "./ui";

const ACTION_LABEL: Record<ModerationActionType, string> = {
  keep: "Kept: it doesn't break the guidelines",
  remove_content: "Removed",
  warn_author: "Warning",
  restrict_author: "Account restricted",
  suspend_author: "Account suspended",
  escalate: "Sent to the myHoodora team",
};

const APPEAL_LABEL = { open: "Appeal under review", upheld: "Appeal reviewed: decision stands", overturned: "Appeal successful: decision reversed" } as const;

/**
 * Moderation decisions about you and your reports, with appeals (Nextdoor:
 * authors and reporters can appeal; a different reviewer decides).
 */
export function ModerationSettings() {
  const { user } = useAuth();
  const [items, setItems] = useState<MyDecision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealing, setAppealing] = useState<MyDecision | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setError(null);
    getMyDecisions(user)
      .then(setItems)
      .catch((err) => setError(errorMessage(err, "Couldn't load your decisions.")));
  }, [user]);

  useEffect(load, [load]);

  const submit = async () => {
    if (!user || !appealing) return;
    setSending(true);
    try {
      await fileAppeal(user, appealing.caseId, reason.trim());
      toast.success("Appeal sent. Someone who didn't make the original decision will review it.");
      setAppealing(null);
      setReason("");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your appeal."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Decisions & appeals"
        description="Moderation decisions about your posts or account, and what happened to things you reported, from the last 90 days."
      >
        {error ? (
          <ErrorState title="Couldn't load decisions" message={error} onRetry={load} className="py-8" />
        ) : items === null ? (
          <div className="h-24 animate-pulse bg-muted/50" aria-busy />
        ) : items.length === 0 ? (
          <EmptyState icon={Scale} title="Nothing here" description="No moderation decisions involve you. Keep being a great neighbour!" className="py-8" />
        ) : (
          items.map((d) => (
            <div key={d.caseId} className="space-y-2 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{d.role === "author" ? `Your ${d.target.type}` : "Your report"}</span>
                <span className={d.action === "keep" ? "text-muted-foreground" : "text-warning"}>{ACTION_LABEL[d.action]}</span>
                <span className="ml-auto font-normal text-muted-foreground">{timeAgo(d.decidedAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-foreground/80">“{d.target.preview}”</p>
              <p className="text-sm text-muted-foreground">Reason: {d.reason}</p>
              {d.appeal ? (
                <p className="text-sm font-semibold text-primary">
                  {APPEAL_LABEL[d.appeal.status]}
                  {d.appeal.outcomeReason && <span className="font-normal text-muted-foreground"> · {d.appeal.outcomeReason}</span>}
                </p>
              ) : d.canAppeal ? (
                <Button size="sm" variant="outline" onClick={() => setAppealing(d)}>
                  Appeal this decision
                </Button>
              ) : null}
            </div>
          ))
        )}
      </SettingsSection>
      <p className="px-1 text-sm text-muted-foreground">
        Decisions follow the{" "}
        <Link href={ROUTES.guidelines} className="font-semibold text-primary hover:underline">
          community guidelines
        </Link>
        . You can appeal each decision once, within 30 days.
      </p>

      <Dialog open={!!appealing} onOpenChange={(o) => !o && setAppealing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Appeal this decision</DialogTitle>
            <DialogDescription>
              {appealing?.role === "reporter"
                ? "Tell us why you think this should be removed after all."
                : "Tell us why you think the decision was wrong. A different member of the team will review it."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Your reason" htmlFor="appeal-reason" hint="At least 10 characters.">
            <textarea id="appeal-reason" rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldInputClass} h-auto py-2`} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAppealing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={sending || reason.trim().length < 10}>
              {sending ? "Sending…" : "Send appeal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
