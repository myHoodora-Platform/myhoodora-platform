"use client";

import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { ForSalePage } from "@/features/for-sale/for-sale-page";

export default function Page() {
  return (
    <VerifiedGate>
      <Suspense>
        <ForSalePage />
      </Suspense>
    </VerifiedGate>
  );
}
