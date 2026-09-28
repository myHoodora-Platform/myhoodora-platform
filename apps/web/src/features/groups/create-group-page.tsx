"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader, PreviewNotice } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { createGroup } from "@/lib/api/groups";
import { ROUTES } from "@/lib/routes";
import { GroupForm } from "./group-form";

export function CreateGroupPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink fallback={ROUTES.groups} label="Groups" />
      <PageHeader
        title="Create a group"
        description="Bring neighbours together around your street, estate, safety, kids or a shared interest. You'll be the group's admin."
      />
      <PreviewNotice endpoint="groups" />
      <GroupForm
        mode="create"
        submitLabel="Create group"
        onCancel={() => router.push(ROUTES.groups)}
        onSubmit={async (input) => {
          if (!user || !profile?.neighborhoodId) throw new Error("You need to be signed in.");
          const group = await createGroup(user, profile.neighborhoodId, input);
          toast.success(`“${group.name}” is ready.`);
          // Land on the new group with the invite dialog open (Nextdoor's next step).
          router.push(`${ROUTES.group(group._id)}?created=1`);
        }}
      />
    </div>
  );
}
