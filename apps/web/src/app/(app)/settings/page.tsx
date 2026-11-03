import type { Metadata } from "next";
import { ProfileSettings } from "@/features/settings/profile-settings";

export const metadata: Metadata = { title: "Settings | myHoodora" };

/** Phones show the section list (from the layout); desktop opens the first section. */
export default function Page() {
  return <ProfileSettings />;
}
