import { Suspense } from "react";
import { MarketplacePage } from "@/features/admin/content/marketplace-page";

export default function Page() {
  return (
    <Suspense>
      <MarketplacePage />
    </Suspense>
  );
}
