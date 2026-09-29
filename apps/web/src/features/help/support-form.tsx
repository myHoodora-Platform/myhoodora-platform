"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { SUPPORT_TOPICS, submitSupportRequest, type SupportTopic } from "@/lib/api/support";

/** "Contact support" on the help centre → the team inbox (replies by email + notification). */
export function SupportForm() {
  const { user } = useAuth();
  const [topic, setTopic] = useState<SupportTopic>("account");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const tooShort = message.trim().length < 20;

  if (!user) return null;

  if (sent) {
    return (
      <div className="flex items-start gap-3 p-4 text-sm" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-semibold">Thanks, we&apos;ve got it.</span> We&apos;ll reply to {user.email ?? "your email"} and in your notifications, usually within two working
          days.
        </p>
      </div>
    );
  }

  const send = async () => {
    setSending(true);
    try {
      await submitSupportRequest(user, { topic, message: message.trim() });
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your message."));
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) void send();
      }}
    >
      <Field label="What do you need help with?" htmlFor="support-topic">
        <select id="support-topic" value={topic} onChange={(e) => setTopic(e.target.value as SupportTopic)} className={fieldInputClass}>
          {SUPPORT_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tell us what's happening" htmlFor="support-message" hint={topic === "safety" ? "If anyone is in danger right now, call 112 first." : "At least 20 characters."}>
        <textarea id="support-message" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={`${fieldInputClass} h-auto py-2`} />
      </Field>
      <Button type="submit" disabled={sending || tooShort}>
        {sending ? "Sending…" : "Send to support"}
      </Button>
    </form>
  );
}
