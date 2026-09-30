"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { SUPPORT_TOPICS, submitSupportRequest, type SupportTopic } from "@/lib/api/support";
import { ROUTES } from "@/lib/routes";

/** How long replies usually take (shown wherever someone contacts support). */
export const SUPPORT_REPLY_TIME = "usually within two working days";

/**
 * "Contact support" → opens a conversation in the team inbox and takes you
 * to it in Messages, where the team's replies arrive live.
 */
export function SupportForm({ onSent }: { onSent?: (threadId: string) => void } = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const [topic, setTopic] = useState<SupportTopic>("account");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const tooShort = message.trim().length < 20;

  if (!user) return null;

  const send = async () => {
    setSending(true);
    try {
      const { id } = await submitSupportRequest(user, { topic, message: message.trim() });
      toast.success("Message sent. We'll reply here in Messages.");
      if (onSent) onSent(id);
      else router.push(ROUTES.supportThread(id));
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
