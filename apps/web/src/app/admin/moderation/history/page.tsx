import { Suspense } from "react";
import { HistoryPage } from "@/features/admin/moderation/history-page";

export default function Page() {
  return (
    <Suspense>
      <HistoryPage />
    </Suspense>
  );
}
