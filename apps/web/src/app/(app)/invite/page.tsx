import type { Metadata } from "next";
import { InvitePage } from "@/features/invites/invite-page";

export const metadata: Metadata = { title: "Invite neighbours | myHoodora" };

export default function Page() {
  return <InvitePage />;
}
