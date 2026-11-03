"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, MoreHorizontal, ShieldOff, UserMinus, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, fieldInputClass } from "@/components/shared/field";
import { FilterChips } from "@/components/shared/filter-chips";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { EmptyState, PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import {
  approveRequest,
  canDeleteGroup,
  declineRequest,
  deleteGroup,
  getGroup,
  leaveGroup,
  listMembers,
  listRequests,
  removeMember,
  setMemberRole,
  updateGroup,
} from "@/lib/api/groups";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { pluralize } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Group, GroupJoinRequest, GroupMember } from "@/lib/api/types";
import { SettingsRow, SettingsSection } from "@/features/settings/ui";
import { GroupForm } from "./group-form";

type Tab = "requests" | "members" | "details";

export function ManageGroupPage({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const viewer = useViewer();
  const tabParam = useSearchParams().get("tab");
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [removing, setRemoving] = useState<GroupMember | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const g = await getGroup(user, id);
    setGroup(g);
    if (!g?.isAdmin) return;
    const [m, r] = await Promise.all([listMembers(user, id), g.privacy === "private" ? listRequests(user, id) : []]);
    setMembers(m);
    setRequests(r);
  }, [user, id]);

  useEffect(() => {
    void reload().catch(() => setGroup(null));
  }, [reload]);

  if (group === undefined) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" />;
  if (!group || !group.isAdmin) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Only group admins can manage this group"
        description="Ask an admin to make you an admin if you help run it."
        action={
          <Button size="sm" variant="outline" onClick={() => router.push(group ? ROUTES.group(group._id) : ROUTES.groups)}>
            Back to group
          </Button>
        }
      />
    );
  }

  const defaultTab: Tab = group.privacy === "private" && requests.length > 0 ? "requests" : "members";
  const tab: Tab = tabParam === "requests" || tabParam === "members" || tabParam === "details" ? tabParam : defaultTab;
  const tabs = [
    ...(group.privacy === "private" ? [{ id: "requests" as const, label: "Requests", count: requests.length }] : []),
    { id: "members" as const, label: "Members", count: group.memberCount },
    { id: "details" as const, label: "Edit details" },
  ];
  const admins = members.filter((m) => m.role === "admin").length;

  const act = async (fn: () => Promise<void>, success?: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err, "That didn't work."));
    } finally {
      setBusy(false);
    }
  };

  const name = (uid: string) => resolveAuthor(uid, viewer).displayName;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink fallback={ROUTES.group(group._id)} label={group.name} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage group</h1>
        <p className="text-sm text-muted-foreground">
          {group.name} · {pluralize(group.memberCount, "member")}
        </p>
      </div>
      <PreviewNotice endpoint="groups" />
      <FilterChips
        label="Manage group"
        items={tabs}
        active={tab}
        hrefFor={(t) => `${ROUTES.groupManage(group._id)}?tab=${t}`}
      />

      {tab === "requests" && (
        <SettingsSection title="Join requests" description="Neighbours who asked to join. They aren't told if you decline.">
          {requests.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">No one is waiting. You&apos;re all caught up.</p>
          ) : (
            requests.map((r) => {
              const person = resolveAuthor(r.uid, viewer);
              return (
                <div key={r.uid} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <UserAvatar person={person} />
                  <div className="min-w-0 flex-1">
                    <Link href={ROUTES.profile(r.uid)} className="font-semibold hover:underline">
                      {person.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[person.neighborhoodName, `asked ${timeAgo(r.requestedAt)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void act(() => approveRequest(user!, group._id, r.uid), `${person.displayName} joined the group.`)}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(() => declineRequest(user!, group._id, r.uid), "Request declined.")}
                    >
                      <X className="size-4" /> Decline
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </SettingsSection>
      )}

      {tab === "members" && (
        <SettingsSection
          title="Members"
          description={
            group.memberCount > members.length
              ? `Showing ${members.length} of ${group.memberCount}. The full list loads from the server when it's connected.`
              : "Admins can edit the group, approve requests and remove posts or members."
          }
        >
          {members.map((m) => {
            const person = resolveAuthor(m.uid, viewer);
            const isMe = m.uid === user?.uid;
            return (
              <div key={m.uid} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <UserAvatar person={person} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <Link href={ROUTES.profile(m.uid)} className="truncate hover:underline">
                      {isMe ? `${person.displayName} (you)` : person.displayName}
                    </Link>
                    {m.role === "admin" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        <Crown className="size-3" aria-hidden /> Admin
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Joined {timeAgo(m.joinedAt)}</p>
                </div>
                {!isMe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Options for ${person.displayName}`} className="flex size-10 items-center justify-center rounded-full hover:bg-muted">
                        <MoreHorizontal className="size-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      {m.role === "member" ? (
                        <DropdownMenuItem onSelect={() => void act(() => setMemberRole(user!, group._id, m.uid, "admin"), `${person.displayName} is now an admin.`)}>
                          <Crown className="size-4" /> Make admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => void act(() => setMemberRole(user!, group._id, m.uid, "member"), `${person.displayName} is no longer an admin.`)}>
                          <ShieldOff className="size-4" /> Remove as admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => setRemoving(m)}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <UserMinus className="size-4" /> Remove from group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </SettingsSection>
      )}

      {tab === "details" && (
        <>
          <GroupForm
            mode="edit"
            initial={group}
            submitLabel="Save changes"
            onCancel={() => router.push(ROUTES.group(group._id))}
            onSubmit={async (input) => {
              if (!user) return;
              setGroup(await updateGroup(user, group._id, input));
              toast.success("Group updated.");
              await reload();
            }}
          />
          <SettingsSection title="Danger zone" tone="danger">
            <SettingsRow
              label="Leave group"
              description={admins <= 1 && group.memberCount > 1 ? "You're the only admin. Make someone else an admin first." : "You'll stop being a member and admin."}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await leaveGroup(user!, group._id);
                    router.replace(ROUTES.groups);
                  }, "You left the group.")
                }
              >
                Leave
              </Button>
            </SettingsRow>
            <SettingsRow
              label="Delete group"
              description={
                canDeleteGroup(group._id, user!.uid)
                  ? "Permanently delete the group and its posts."
                  : "Other neighbours have posted here, so it can't be deleted. You can leave it or hand it to another admin."
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
                disabled={busy || !canDeleteGroup(group._id, user!.uid)}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </SettingsRow>
          </SettingsSection>
        </>
      )}

      <ResponsiveModal
        open={removing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRemoving(null);
            setReason("");
          }
        }}
        title={removing ? `Remove ${name(removing.uid)}?` : "Remove member"}
        description="They'll be notified and can ask to join again later."
      >
        <div className="space-y-4">
          <Field label="Reason" htmlFor="remove-reason" optional hint="Shared with them in the notification.">
            <textarea id="remove-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className={fieldInputClass} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive shadow-none hover:bg-destructive/90"
              loading={busy}
              onClick={() => {
                const target = removing;
                if (!target) return;
                void act(async () => {
                  await removeMember(user!, group._id, target.uid, reason.trim() || undefined);
                  setRemoving(null);
                  setReason("");
                }, `${name(target.uid)} was removed.`);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${group.name}?`}
        description="This permanently deletes the group and its posts. This can't be undone."
        confirmLabel="Delete group"
        destructive
        loading={busy}
        onConfirm={() =>
          void act(async () => {
            await deleteGroup(user!, group._id);
            setConfirmDelete(false);
            router.replace(ROUTES.groups);
          }, "Group deleted.")
        }
      />
    </div>
  );
}
