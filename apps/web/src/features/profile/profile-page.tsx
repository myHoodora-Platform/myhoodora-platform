"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, MessageCircle, Pencil, UserX } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/features/feed/feed-context";
import { PostCard } from "@/features/feed/components/post-card";
import { useViewer } from "@/hooks/use-neighbourhood";
import { startConversation } from "@/lib/api/chat";
import { errorMessage } from "@/lib/api/client";
import { getPublicProfile } from "@/lib/api/users";
import { formatMonthYear } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { PublicProfile } from "@/lib/api/types";

export function ProfilePage({ uid }: { uid: string }) {
  const router = useRouter();
  const { user, runGatedAction } = useAuth();
  const viewer = useViewer();
  const { posts, react, deletePost } = useFeed();
  const [person, setPerson] = useState<PublicProfile | null | undefined>(undefined);
  const [messaging, setMessaging] = useState(false);
  const isMe = uid === user?.uid;

  useEffect(() => {
    if (user) void getPublicProfile(user, uid, viewer).then(setPerson).catch(() => setPerson(null));
    // viewer changes identity only when the profile loads; name edits re-render via isMe below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, uid]);

  if (person === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (person === null) {
    return (
      <EmptyState
        icon={UserX}
        title="Profile not available"
        description="This neighbour's profile can't be shown yet. Public profiles are coming soon."
      />
    );
  }

  const shown: PublicProfile = isMe ? { ...person, displayName: viewer.profile?.displayName ?? person.displayName } : person;
  const theirPosts = posts.filter((p) => p.authorUid === uid);

  const message = () =>
    runGatedAction(async () => {
      if (!user) return;
      setMessaging(true);
      try {
        const convo = await startConversation(user, uid);
        router.push(ROUTES.conversation(convo._id));
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't start the conversation."));
        setMessaging(false);
      }
    });

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-24 bg-gradient-to-r from-primary/80 to-primary sm:h-32" />
        <div className="space-y-3 px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <UserAvatar person={shown} size="xl" className="ring-4 ring-card" />
            {isMe ? (
              <Button variant="outline" size="sm" onClick={() => router.push(ROUTES.settingsAccount)}>
                <Pencil className="size-4" /> Edit profile
              </Button>
            ) : (
              <Button size="sm" onClick={message} loading={messaging}>
                <MessageCircle className="size-4" /> Message
              </Button>
            )}
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
              {shown.displayName}
              {shown.verified && <BadgeCheck className="size-5 text-primary" aria-label="Verified neighbour" />}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[shown.neighborhoodName, shown.neighbourSince && `Neighbour since ${formatMonthYear(shown.neighbourSince)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {shown.bio && <p className="text-[15px] text-foreground/85">{shown.bio}</p>}
        </div>
      </header>

      <section aria-labelledby="profile-posts" className="space-y-3">
        <h2 id="profile-posts" className="text-base font-bold">
          {isMe ? "Your posts" : `Posts by ${shown.displayName.split(" ")[0]}`}
        </h2>
        {theirPosts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No recent posts.
          </p>
        ) : (
          theirPosts.map((p) => <PostCard key={p._id} post={p} onReact={react} onDelete={deletePost} />)
        )}
      </section>
    </div>
  );
}
