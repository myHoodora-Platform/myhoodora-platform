"use client";

import { Suspense } from "react";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { EventsPage } from "@/features/events/events-page";

export default function Page() {
  return (
    <VerifiedGate>
      <Suspense>
        <EventsPage />
      </Suspense>
    </VerifiedGate>
  );
}
