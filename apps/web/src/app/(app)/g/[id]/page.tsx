import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { GroupPage } from "@/features/groups/group-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <VerifiedGate>
      <GroupPage id={id} />
    </VerifiedGate>
  );
}
