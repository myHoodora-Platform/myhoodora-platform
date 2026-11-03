import type { Metadata } from "next";
import { LeadsPage } from "@/features/leads/leads-page";

export const metadata: Metadata = { title: "Hood Lead reviews | myHoodora" };

export default function Page() {
  return <LeadsPage />;
}
