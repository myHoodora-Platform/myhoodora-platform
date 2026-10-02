"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { cn } from "@myhoodora/ui/utils";
import { errorMessage } from "@/lib/api/client";
import { fieldInputClass } from "@/components/shared/field";

export interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words (who is affected, is it reversible). */
  consequence: React.ReactNode;
  /** Preset reasons; the first is not pre-selected so the moderator chooses. */
  reasons?: string[];
  requireReason?: boolean;
  confirmLabel: string;
  destructive?: boolean;
  /** Extra fields (duration, Hood picker, message to the neighbour…). */
  children?: React.ReactNode;
  /** Disable confirm until extra fields are valid. */
  ready?: boolean;
  onConfirm: (input: { reason: string; note?: string }) => Promise<void>;
}

/**
 * Every admin action goes through this: consequence first, a reason that is
 * recorded in the audit log, and a clear confirm. Errors stay in the dialog.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  consequence,
  reasons,
  requireReason = true,
  confirmLabel,
  destructive,
  children,
  ready = true,
  onConfirm,
}: ActionDialogProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setNote("");
      setError(null);
    }
  }, [open]);

  const canConfirm = ready && (!requireReason || !reasons?.length || reason !== "") && !busy;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason: reason || (reasons?.length ? "" : title), note: note.trim() || undefined });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "That didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className={cn("flex gap-2 rounded-xl p-3 text-sm", destructive ? "bg-danger-soft/60 text-foreground" : "bg-muted text-foreground")}>
              <Info className={cn("mt-0.5 size-4 shrink-0", destructive ? "text-destructive" : "text-primary")} aria-hidden />
              <div>{consequence}</div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {reasons && reasons.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Reason {requireReason && <span className="text-destructive">*</span>}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {reasons.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      reason === r ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--primary)]" />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {children}
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">
              Internal note <span className="font-normal text-muted-foreground">(optional, staff only)</span>
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={fieldInputClass} placeholder="Context for other moderators" />
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={!canConfirm}
            loading={busy}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
