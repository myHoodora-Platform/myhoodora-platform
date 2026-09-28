"use client";

import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { GroupsPage } from "@/features/groups/groups-page";

export default function Page() {
  return (
    <VerifiedGate>
      <Suspense>
        <GroupsPage />
      </Suspense>
    </VerifiedGate>
  );
}
