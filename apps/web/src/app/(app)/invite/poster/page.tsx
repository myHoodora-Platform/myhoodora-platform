import { Suspense } from "react";
import type { Metadata } from "next";
import { InvitePoster } from "@/features/invites/invite-poster";

export const metadata: Metadata = { title: "Invite poster | myHoodora" };

export default function Page() {
  // Reads ?code= on the client.
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-2xl bg-muted" aria-label="Making the poster" />}>
      <InvitePoster />
    </Suspense>
  );
}
