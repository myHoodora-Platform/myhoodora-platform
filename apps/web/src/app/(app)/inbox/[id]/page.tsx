import { Suspense } from "react";
import { ConversationThread } from "@/features/chat/conversation-thread";
import { InboxLayout } from "@/features/chat/inbox-layout";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <InboxLayout activeId={id}>
      <Suspense>
        <ConversationThread key={id} id={id} />
      </Suspense>
    </InboxLayout>
  );
}
