import { InboxLayout } from "@/features/chat/inbox-layout";
import { SupportThreadView } from "@/features/support/support-thread";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <InboxLayout activeId="support">
      <SupportThreadView key={id} id={id} />
    </InboxLayout>
  );
}
