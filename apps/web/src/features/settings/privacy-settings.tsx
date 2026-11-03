"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ErrorState, PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { errorMessage } from "@/lib/api/client";
import { listBlocked, unblockUser, type Preferences } from "@/lib/api/settings";
import { resolveAuthor } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";
import { Segmented, SettingsRow, SettingsSection, Switch } from "./ui";
import { usePreferences } from "./use-preferences";

const VISIBILITY = [
  { id: "neighbourhood", label: "My neighbourhood" },
  { id: "nearby", label: "Nearby neighbourhoods too" },
] as const;

const MESSAGING = [
  { id: "neighbourhood", label: "Anyone in my neighbourhood" },
  { id: "contacts", label: "Only people I've messaged" },
  { id: "nobody", label: "No one" },
] as const;

function BlockedList() {
  const { user } = useAuth();
  const viewer = useViewer();
  const [blocked, setBlocked] = useState<string[] | null>(null);

  useEffect(() => {
    if (user) void listBlocked(user).then(setBlocked).catch(() => setBlocked([]));
  }, [user]);

  const unblock = async (uid: string, name: string) => {
    if (!user) return;
    try {
      await unblockUser(user, uid);
      setBlocked((b) => b?.filter((u) => u !== uid) ?? null);
      toast.success(`${name} is unblocked.`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't unblock."));
    }
  };

  return (
    <SettingsSection
      title="Blocked neighbours"
      description="Blocked neighbours can't message you or see your posts, and you won't see theirs."
    >
      {blocked === null ? (
        <div className="p-4">
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : blocked.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          You haven&apos;t blocked anyone. You can block someone from their profile.
        </p>
      ) : (
        blocked.map((uid) => {
          const person = resolveAuthor(uid, viewer);
          return (
            <div key={uid} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <UserAvatar person={person} size="sm" />
              <Link href={ROUTES.profile(uid)} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                {person.displayName}
              </Link>
              <Button variant="outline" size="sm" onClick={() => void unblock(uid, person.displayName)}>
                Unblock
              </Button>
            </div>
          );
        })
      )}
    </SettingsSection>
  );
}

export function PrivacySettings() {
  const { prefs, error, change } = usePreferences();

  if (error) return <ErrorState title="Couldn't load your settings" message={error} onRetry={() => window.location.reload()} />;
  if (!prefs) return <Skeleton className="h-96 rounded-2xl" />;

  const setPrivacy = (patch: Partial<Preferences["privacy"]>) =>
    void change({ ...prefs, privacy: { ...prefs.privacy, ...patch } });

  return (
    <div className="space-y-4">
      <PreviewNotice endpoint="settings" />
      <SettingsSection title="Privacy" description="Your exact address is never shown to anyone.">
        <div className="space-y-2 px-4 py-4 sm:px-5">
          <p className="text-[15px] font-semibold">Who can see your full profile</p>
          <Segmented
            label="Who can see your full profile"
            value={prefs.privacy.profileVisibility}
            options={VISIBILITY}
            onChange={(profileVisibility) => setPrivacy({ profileVisibility })}
          />
        </div>
        <div className="space-y-2 px-4 py-4 sm:px-5">
          <p className="text-[15px] font-semibold">Who can message you</p>
          <Segmented
            label="Who can message you"
            value={prefs.privacy.messaging}
            options={MESSAGING}
            onChange={(messaging) => setPrivacy({ messaging })}
          />
        </div>
        <SettingsRow label="Show “Neighbour since” on your profile" description="Helps neighbours trust newer and long-time residents alike.">
          <Switch
            label="Show neighbour since"
            checked={prefs.privacy.showNeighbourSince}
            onChange={(showNeighbourSince) => setPrivacy({ showNeighbourSince })}
          />
        </SettingsRow>
      </SettingsSection>
      <BlockedList />
    </div>
  );
}
