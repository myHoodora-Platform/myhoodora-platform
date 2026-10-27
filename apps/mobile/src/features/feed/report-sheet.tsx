import type { ReportReason } from "@myhoodora/api-contract/types";
import { errorMessage } from "@myhoodora/api-contract/errors";
import { useState } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { useToast } from "@/shared/ui/toast";
import { report } from "./feed-api";

/** The web's reasons, in its words. */
const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or advertising" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "scam", label: "Scam or fraud" },
  { id: "misinformation", label: "False information" },
  { id: "not_local", label: "Not about this neighbourhood" },
  { id: "other", label: "Something else" },
];

/**
 * "Report", then why. Private: the person reported is never told who. One tap sends it: the sheet
 * closes at once (no wait on the network), and a note says when it's in, or why it isn't.
 */
export function ReportSheet({ visible, onClose, targetType, targetId }: { visible: boolean; onClose: () => void; targetType: "post" | "comment" | "listing" | "user"; targetId: string }) {
  const user = useSignedInUser();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const send = async (reason: ReportReason) => {
    if (sending) return;
    setSending(true);
    onClose();
    try {
      await report(user, targetType, targetId, reason);
      toast("Thanks. Our team and your Neighbourhood Leads will review it.");
    } catch (err) {
      toast(`Your report wasn't sent: ${errorMessage(err)}`, "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet visible={visible} title={targetType === "user" ? "Why are you reporting this neighbour?" : `Why are you reporting this ${targetType}?`} onClose={onClose}>
      {REASONS.map((r) => (
        <SheetItem key={r.id} label={r.label} onPress={() => void send(r.id)} />
      ))}
    </Sheet>
  );
}
