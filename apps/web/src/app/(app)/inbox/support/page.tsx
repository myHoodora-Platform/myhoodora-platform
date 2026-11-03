import { InboxLayout } from "@/features/chat/inbox-layout";
import { SupportConversations } from "@/features/support/support-conversations";

export default function Page() {
  return (
    <InboxLayout activeId="support">
      <SupportConversations />
    </InboxLayout>
  );
}
