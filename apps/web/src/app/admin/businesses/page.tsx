import { Suspense } from "react";
import { BusinessesPage } from "@/features/admin/businesses/businesses-page";

export default function Page() {
  return (
    <Suspense>
      <BusinessesPage />
    </Suspense>
  );
}
