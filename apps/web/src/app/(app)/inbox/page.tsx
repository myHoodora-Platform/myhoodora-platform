import { MessageCircle } from "lucide-react";
import { InboxLayout } from "@/features/chat/inbox-layout";

export default function Page() {
  return (
    <InboxLayout>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <MessageCircle className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-bold">Select a conversation</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Chats with sellers and neighbours appear here.
        </p>
      </div>
    </InboxLayout>
  );
}
