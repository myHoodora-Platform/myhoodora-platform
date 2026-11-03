"use client";

import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { AlertsPage } from "@/features/alerts/alerts-page";

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <VerifiedGate>
        <Suspense>
          <AlertsPage />
        </Suspense>
      </VerifiedGate>
    </div>
  );
}
