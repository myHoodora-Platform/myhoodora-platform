import { Suspense } from "react";
import { AlertsPage } from "@/features/admin/content/alerts-page";

export default function Page() {
  return (
    <Suspense>
      <AlertsPage />
    </Suspense>
  );
}
