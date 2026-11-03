import { Suspense } from "react";
import { NeighboursPage } from "@/features/admin/community/neighbours-page";

export default function Page() {
  return (
    <Suspense>
      <NeighboursPage />
    </Suspense>
  );
}
