import { Suspense } from "react";
import { QueuePage } from "@/features/admin/moderation/queue-page";

export default function Page() {
  return (
    <Suspense>
      <QueuePage />
    </Suspense>
  );
}
