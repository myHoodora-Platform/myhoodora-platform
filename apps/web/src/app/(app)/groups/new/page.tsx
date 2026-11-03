import type { Metadata } from "next";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { CreateGroupPage } from "@/features/groups/create-group-page";

export const metadata: Metadata = { title: "Create a group | myHoodora" };

export default function Page() {
  return (
    <VerifiedGate>
      <CreateGroupPage />
    </VerifiedGate>
  );
}
