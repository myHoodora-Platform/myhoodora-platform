"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, Lock, SendHorizontal, Users } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState, PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { createGroupPost, getGroup, listGroupPosts } from "@/lib/api/groups";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { pluralize } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Group, GroupPost } from "@/lib/api/types";
import { GROUP_CATEGORY } from "./constants";
import { GroupJoinButton } from "./group-join-button";

export function GroupPage({ id }: { id: string }) {
  const { user } = useAuth();
  const viewer = useViewer();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const canRead = group && (group.privacy === "open" || group.membership === "member");

  useEffect(() => {
    if (user) void getGroup(user, id).then(setGroup).catch(() => setGroup(null));
  }, [user, id]);

  useEffect(() => {
    if (user && canRead) void listGroupPosts(user, id).then(setPosts);
  }, [user, id, canRead]);

  if (group === undefined) return <Skeleton className="h-64 rounded-2xl" />;
  if (group === null) {
    return <EmptyState icon={Users} title="Group not found" description="It may have been closed by its lead." />;
  }

  const cat = GROUP_CATEGORY[group.category];
  const isMember = group.membership === "member";

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink fallback={ROUTES.groups} label="Groups" />
      <header className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl", cat.tone)}>
            <cat.icon className="size-8" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight">{group.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {group.privacy === "private" ? <Lock className="size-3.5" aria-hidden /> : <Globe className="size-3.5" aria-hidden />}
              {group.privacy === "private" ? "Private group" : "Open group"} · {pluralize(group.memberCount, "member")} · {cat.label}
            </p>
          </div>
        </div>
        <p className="text-[15px] text-foreground/85">{group.description}</p>
        <GroupJoinButton group={group} size="default" onChange={(membership) => setGroup({ ...group, membership })} />
      </header>

      <PreviewNotice endpoint="groups" />

      {!canRead ? (
        <EmptyState
          icon={Lock}
          title="This group is private"
          description={
            group.membership === "requested"
              ? "Your request is waiting for a group lead to approve it."
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
            <p className="py-6 text-center text-sm text-muted-foreground">No posts in this group yet.</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => {
                const author = resolveAuthor(p.authorUid, viewer);
                return (
                  <li key={p._id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <UserAvatar person={author} size="sm" />
                      <div>
                        <Link href={ROUTES.profile(p.authorUid)} className="text-sm font-bold hover:underline">
                          {author.displayName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
                      </div>
                    </div>
                    <p className="text-[15px] whitespace-pre-wrap">{p.content}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
