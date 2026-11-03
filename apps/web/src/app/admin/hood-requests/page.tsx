import { Suspense } from "react";
import { HoodRequestsPage } from "@/features/admin/community/hood-requests-page";

export default function Page() {
  return (
    <Suspense>
      <HoodRequestsPage />
    </Suspense>
  );
}
