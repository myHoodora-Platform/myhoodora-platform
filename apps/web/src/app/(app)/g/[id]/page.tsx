import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { GroupPage } from "@/features/groups/group-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <VerifiedGate>
      <Suspense>
        <GroupPage id={id} />
      </Suspense>
    </VerifiedGate>
  );
}
