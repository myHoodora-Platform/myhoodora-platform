import { Suspense } from "react";
import { HoodsPage } from "@/features/admin/community/hoods-page";

export default function Page() {
  return (
    <Suspense>
      <HoodsPage />
    </Suspense>
  );
}
