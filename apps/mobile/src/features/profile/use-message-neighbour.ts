import { errorMessage } from "@myhoodora/api-contract/errors";
import { useCallback, useState } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { startConversation } from "@/features/chat/chat-api";
import { useToast } from "@/shared/ui/toast";

/** "Message": opens your conversation with them (the same one every time), or says why it can't. */
export function useMessageNeighbour() {
  const user = useSignedInUser();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = useCallback(
    async (uid: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const convo = await startConversation(user, uid);
        router.push(`/inbox/${convo._id}`);
      } catch (err) {
        toast(errorMessage(err), "error");
      } finally {
        setBusy(false);
      }
    },
    [busy, router, toast, user],
  );
  return { open, busy };
}
