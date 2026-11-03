"use client";

import { Suspense } from "react";
import { PageWithRail } from "@/components/layout/app-shell/right-rail";
import { NotificationsPage } from "@/features/notifications/notifications-page";

export default function Page() {
  return (
    <PageWithRail>
      <Suspense>
        <NotificationsPage />
      </Suspense>
    </PageWithRail>
  );
}
