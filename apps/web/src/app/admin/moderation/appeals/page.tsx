import { Suspense } from "react";
import { AppealsPage } from "@/features/admin/moderation/appeals-page";

export default function Page() {
  return (
    <Suspense>
      <AppealsPage />
    </Suspense>
  );
}
