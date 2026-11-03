"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldInputClass } from "@/components/shared/field";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { submitFeedback, type FeedbackInput } from "@/lib/api/settings";
import { Segmented } from "./ui";

const KINDS: { id: FeedbackInput["kind"]; label: string }[] = [
  { id: "idea", label: "💡 Idea" },
  { id: "problem", label: "🐞 Problem" },
  { id: "praise", label: "💚 Praise" },
  { id: "other", label: "Other" },
];

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [kind, setKind] = useState<FeedbackInput["kind"]>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!user || message.trim().length < 5) return;
    setSending(true);
    try {
      await submitFeedback(user, { kind, message: message.trim(), path: pathname });
      toast.success("Thanks! Your feedback goes straight to the myHoodora team.");
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your feedback."));
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Send feedback" description="Tell us what's working and what isn't. We read everything.">
      <div className="space-y-4">
        <Segmented label="Feedback type" value={kind} options={KINDS} onChange={setKind} />
        <Field label="Your feedback" htmlFor="feedback-message" hint="At least 5 characters.">
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            className={fieldInputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} loading={sending} disabled={message.trim().length < 5}>
            Send feedback
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
