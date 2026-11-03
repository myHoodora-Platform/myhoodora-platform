import { Suspense } from "react";
import { VerificationPage } from "@/features/admin/community/verification-page";

export default function Page() {
  return (
    <Suspense>
      <VerificationPage />
    </Suspense>
  );
}
