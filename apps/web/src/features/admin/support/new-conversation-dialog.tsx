"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { getNeighbour } from "@/lib/api/admin/community";
import { startInboxConversation } from "@/lib/api/admin/support";
import { errorMessage } from "@/lib/api/client";
import { PeoplePicker, type Person } from "../people-picker";
import { useAdminSession } from "../session";

/** Staff start a conversation with one neighbour; it lands in their Messages → myHoodora Support. */
export function NewConversationDialog({ open, onOpenChange, initialUid }: { open: boolean; onOpenChange: (open: boolean) => void; initialUid?: string | null }) {
  const { user } = useAuth();
  const { role } = useAdminSession();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !user || !initialUid) return;
    let alive = true;
    getNeighbour(user, initialUid)
      .then((n) => alive && setPeople([{ uid: n.uid, displayName: n.displayName, hood: n.hood }]))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, user, initialUid]);

  const reset = () => {
    setPeople([]);
    setSubject("");
    setBody("");
  };

  const valid = people.length === 1 && subject.trim().length >= 3 && body.trim().length >= 2;

  const send = async () => {
    if (!user || !valid) return;
    setSending(true);
    try {
      const thread = await startInboxConversation(user, { uid: people[0]!.uid, subject: subject.trim(), body: body.trim() }, role);
      toast.success(`Sent to ${people[0]!.displayName}`);
      reset();
      onOpenChange(false);
      router.push(`/admin/inbox/${thread.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>They get a notification and an email, and can reply in Messages under myHoodora Support.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">To</p>
            <PeoplePicker people={people} onChange={setPeople} max={1} />
          </div>
          <Field label="Subject" htmlFor="nc-subject">
            <input id="nc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={fieldInputClass} placeholder="e.g. About your verification" />
          </Field>
          <Field label="Message" htmlFor="nc-body" hint={`${body.length}/4000`}>
            <textarea id="nc-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} className={`${fieldInputClass} h-auto py-2`} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={sending}>
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
