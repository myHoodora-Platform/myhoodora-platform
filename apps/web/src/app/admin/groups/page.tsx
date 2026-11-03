import { Suspense } from "react";
import { GroupsPage } from "@/features/admin/content/groups-page";

export default function Page() {
  return (
    <Suspense>
      <GroupsPage />
    </Suspense>
  );
}
