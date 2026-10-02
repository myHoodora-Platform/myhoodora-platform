import { Suspense } from "react";
import { InboxPage } from "@/features/admin/support/inbox-page";

export default function Page() {
  return (
    <Suspense>
      <InboxPage />
    </Suspense>
  );
}
