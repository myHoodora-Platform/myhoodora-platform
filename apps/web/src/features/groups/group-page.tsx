"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Globe, Lock, MailOpen, MapPinned, Settings2, SendHorizontal, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { BackLink } from "@/components/shared/back-link";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { EmptyState, PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import { useViewer } from "@/hooks/use-neighbourhood";
import { createGroupPost, deleteGroupPost, getGroup, joinGroup, listGroupPosts } from "@/lib/api/groups";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { pluralize } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Group, GroupPost } from "@/lib/api/types";
import { GROUP_CATEGORY, boundaryLabel } from "./constants";
import { GroupJoinButton } from "./group-join-button";
import { InviteDialog } from "./invite-dialog";

export function GroupPage({ id }: { id: string }) {
  const { user, runGatedAction } = useAuth();
  const viewer = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inviteToken = params.get("invite");
  const justCreated = params.get("created") === "1";
  // Remembered after the URL is tidied, so the invite dialog keeps its "ready" wording.
  const [createdFlow] = useState(justCreated);

  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joiningByInvite, setJoiningByInvite] = useState(false);

  const canRead = group && (group.privacy === "open" || group.membership === "member");

  useEffect(() => {
    if (user) void getGroup(user, id, inviteToken ?? undefined).then(setGroup).catch(() => setGroup(null));
  }, [user, id, inviteToken]);

  // Live: new and deleted posts in this group (members get group.post).
  const postsVersion = useLiveVersion("group.post", { filter: (e) => e.groupId === id });
  useEffect(() => {
    if (user && canRead) void listGroupPosts(user, id).then(setPosts);
  }, [user, id, canRead, postsVersion]);

  // After creating a group, go straight to inviting (then tidy the URL).
  useEffect(() => {
    if (justCreated && group?.isAdmin) {
      setInviteOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [justCreated, group?.isAdmin, pathname, router]);

  if (group === undefined) return <Skeleton className="h-64 rounded-2xl" />;
  if (group === null) {
    return <EmptyState icon={Users} title="Group not found" description="It may have been closed by its admin." />;
  }

  const cat = GROUP_CATEGORY[group.category];
  const isMember = group.membership === "member";
  const canInvite = isMember && (group.privacy === "open" || group.isAdmin);
  const showInviteBanner = !!inviteToken && group.membership !== "member";

  const joinWithInvite = () =>
    runGatedAction(async () => {
      if (!user) return;
      setJoiningByInvite(true);
      try {
        const membership = await joinGroup(user, group, inviteToken ?? undefined);
        setGroup((await getGroup(user, id, inviteToken ?? undefined)) ?? { ...group, membership });
        toast.success(`Welcome to ${group.name}!`);
        router.replace(pathname, { scroll: false });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't join the group."));
      } finally {
        setJoiningByInvite(false);
      }
    });

  const post = async () => {
    if (!user || !draft.trim()) return;
    setPosting(true);
    try {
      const created = await createGroupPost(user, id, draft.trim());
      setPosts((prev) => [created, ...prev]);
      setDraft("");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't post to the group."));
    } finally {
      setPosting(false);
    }
  };

  const removePost = async (postId: string) => {
    if (!user) return;
    const previous = posts;
    setPosts((p) => p.filter((x) => x._id !== postId));
    try {
      await deleteGroupPost(user, id, postId);
      toast.success("Post removed.");
    } catch (err) {
      setPosts(previous);
      toast.error(errorMessage(err, "Couldn't remove the post."));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink fallback={ROUTES.groups} label="Groups" />

      {showInviteBanner && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <MailOpen className="size-6 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-bold">You&apos;ve been invited to join {group.name}.</span>{" "}
            {group.privacy === "private" && "No approval needed with this invite."}
          </p>
          <Button size="sm" onClick={joinWithInvite} loading={joiningByInvite}>
            Join group
          </Button>
        </div>
      )}

      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        {group.coverPhoto ? (
          <ImageWithFallback src={group.coverPhoto} alt="" className="h-36 w-full object-cover sm:h-48" />
        ) : (
          <div className={cn("flex h-24 items-center justify-center sm:h-28", cat.tone)}>
            <cat.icon className="size-10 opacity-60" aria-hidden />
          </div>
        )}
        <div className="space-y-4 p-5">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
              {group.name}
              {group.official && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  <BadgeCheck className="size-3.5" aria-hidden /> Official
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {group.privacy === "private" ? <Lock className="size-3.5" aria-hidden /> : <Globe className="size-3.5" aria-hidden />}
                {group.privacy === "private" ? "Private group" : "Open group"}
              </span>
              <span>{pluralize(group.memberCount, "member")}</span>
              <span className="inline-flex items-center gap-1">
                <MapPinned className="size-3.5" aria-hidden /> {boundaryLabel(group.boundary)}
              </span>
              <span>{cat.label}</span>
            </p>
          </div>
          <p className="text-[15px] whitespace-pre-wrap text-foreground/85">{group.description}</p>
          <div className="flex flex-wrap gap-2">
            {!group.isAdmin && !showInviteBanner && (
              <GroupJoinButton group={group} size="default" onChange={(membership) => setGroup({ ...group, membership })} />
            )}
            {canInvite && (
              <Button variant={group.isAdmin ? "default" : "outline"} onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" /> Invite
              </Button>
            )}
            {group.isAdmin && (
              <Link
                href={ROUTES.groupManage(group._id)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-muted"
              >
                <Settings2 className="size-4" /> Manage group
              </Link>
            )}
          </div>
        </div>
      </header>

      <PreviewNotice endpoint="groups" />

      {!canRead ? (
        <EmptyState
          icon={Lock}
          title="This group is private"
          description={
            group.membership === "requested"
              ? "Your request is waiting for a group admin to approve it."
              : "Request to join to see posts and members."
          }
        />
      ) : (
        <>
          {isMember && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void post();
              }}
              className="flex items-end gap-2 rounded-2xl border border-border bg-card p-3"
            >
              <label htmlFor="group-post" className="sr-only">
                Post to {group.name}
              </label>
              <textarea
                id="group-post"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder={`Post to ${group.name}…`}
                className="min-h-11 flex-1 resize-y rounded-xl border border-input px-3 py-2 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="submit"
                disabled={!draft.trim() || posting}
                aria-label="Post to group"
                className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                <SendHorizontal className="size-5" aria-hidden />
              </button>
            </form>
          )}
          {posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {group.isAdmin ? "No posts yet. Start the conversation or invite neighbours." : "No posts in this group yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => {
                const author = resolveAuthor(p.authorUid, viewer);
                const canRemove = p.authorUid === user?.uid || group.isAdmin;
                return (
                  <li key={p._id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <UserAvatar person={author} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={ROUTES.profile(p.authorUid)} className="text-sm font-bold hover:underline">
                          {author.displayName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
                      </div>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => void removePost(p._id)}
                          aria-label={p.authorUid === user?.uid ? "Delete your post" : "Remove post as admin"}
                          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[15px] whitespace-pre-wrap">{p.content}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <InviteDialog group={group} open={inviteOpen} onOpenChange={setInviteOpen} justCreated={createdFlow} />
    </div>
  );
}
