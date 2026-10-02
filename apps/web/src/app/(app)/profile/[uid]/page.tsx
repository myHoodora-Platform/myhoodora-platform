import { PageWithRail } from "@/components/layout/app-shell/right-rail";
import { ProfilePage } from "@/features/profile/profile-page";

export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <PageWithRail>
      <ProfilePage uid={uid} />
    </PageWithRail>
  );
}
