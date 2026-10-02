"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@myhoodora/ui/dialog";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { submitReport } from "@/lib/api/reports";
import { errorMessage } from "@/lib/api/client";
import type { ReportInput, ReportReason } from "@/lib/api/types";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "scam", label: "Scam or fraud" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "misinformation", label: "False or misleading" },
  { id: "spam", label: "Spam or advertising" },
  { id: "not_local", label: "Not about this neighbourhood" },
  { id: "other", label: "Something else" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Pick<ReportInput, "targetType" | "targetId">;
}

export function ReportDialog({ open, onOpenChange, target }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    onOpenChange(false);
    setReason(null);
    setDetails("");
  };

  const submit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      await submitReport(user, { ...target, reason, details: details.trim() || undefined });
      toast.success("Thanks — a neighbourhood lead will review this.");
      close();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your report."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {target.targetType === "user" ? "neighbour" : target.targetType}</DialogTitle>
          <DialogDescription>
            Reports are private. The person won&apos;t know who reported them.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="sr-only">Reason</legend>
          {REASONS.map((r) => (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted",
                reason === r.id && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                className="size-4 accent-[var(--primary)]"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="report-details" className="text-sm font-semibold">
            Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!reason} loading={submitting}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
