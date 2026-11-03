"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Search, Share2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { fieldInputClass } from "@/components/shared/field";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getInviteLink, inviteNeighbours, invitedUids, listMembers, searchNeighbours } from "@/lib/api/groups";
import type { Group, PublicProfile } from "@/lib/api/types";

interface InviteDialogProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown right after creating a group. */
  justCreated?: boolean;
}

/**
 * Nextdoor's Invite: share a join link (WhatsApp first — that's how
 * Nigerian neighbours share) or invite neighbours by name.
 */
export function InviteDialog({ group, open, onOpenChange, justCreated }: InviteDialogProps) {
  const { user } = useAuth();
  const [link, setLink] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PublicProfile[]>([]);
  const [memberUids, setMemberUids] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    void getInviteLink(user, group._id).then(setLink).catch(() => setLink(null));
    void listMembers(user, group._id).then((m) => setMemberUids(new Set(m.map((x) => x.uid)))).catch(() => undefined);
    setInvited(new Set(invitedUids(group._id)));
  }, [open, user, group._id]);

  useEffect(() => {
    if (!open || !user) return;
    const t = setTimeout(() => void searchNeighbours(user, query).then(setPeople).catch(() => setPeople([])), 200);
    return () => clearTimeout(t);
  }, [open, user, query]);

  const message = `Join “${group.name}” on myHoodora, a group for neighbours in our area.`;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: group.name, text: message, url: link });
      } catch {
        // Cancelled — nothing to do.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`, "_blank", "noopener");
  };

  const invite = async (person: PublicProfile) => {
    if (!user) return;
    try {
      await inviteNeighbours(user, group._id, [person.uid]);
      setInvited((s) => new Set(s).add(person.uid));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the invite."));
    }
  };

  const candidates = people.filter((p) => p.uid !== user?.uid);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={justCreated ? "Your group is ready. Invite neighbours" : `Invite to ${group.name}`}
      description={
        group.privacy === "private"
          ? "People with the link can join without waiting for approval, so share it only with neighbours you trust."
          : "Anyone with the link can see the group and join."
      }
      className="sm:max-w-lg"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Share a link</p>
          <div className="flex gap-2">
            <input readOnly value={link ?? "Creating link…"} aria-label="Invite link" className={fieldInputClass} onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={copy} disabled={!link} aria-label="Copy invite link">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button className="w-full" onClick={share} disabled={!link}>
            <Share2 className="size-4" /> Share on WhatsApp or other apps
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Invite neighbours by name</p>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search neighbours"
              aria-label="Search neighbours"
              className={`${fieldInputClass} pl-9`}
            />
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {candidates.length === 0 ? (
              <li className="p-4 text-center text-sm text-muted-foreground">No neighbours match “{query}”.</li>
            ) : (
              candidates.map((p) => {
                const isMember = memberUids.has(p.uid);
                const isInvited = invited.has(p.uid);
                return (
                  <li key={p.uid} className="flex items-center gap-3 px-3 py-2.5">
                    <UserAvatar person={p} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.displayName}</span>
                    {isMember ? (
                      <span className="text-sm text-muted-foreground">Member</span>
                    ) : isInvited ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                        <Check className="size-4" aria-hidden /> Invited
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void invite(p)}>
                        Invite
                      </Button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
          {justCreated ? "Skip for now" : "Done"}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
