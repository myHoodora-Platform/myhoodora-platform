import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { ManageGroupPage } from "@/features/groups/manage-group-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <VerifiedGate>
      <Suspense>
        <ManageGroupPage id={id} />
      </Suspense>
    </VerifiedGate>
  );
}
