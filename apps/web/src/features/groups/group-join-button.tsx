"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Lock, Plus } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { joinGroup, leaveGroup } from "@/lib/api/groups";
import { errorMessage } from "@/lib/api/client";
import type { Group } from "@/lib/api/types";

/** Join (open) vs Request (private), then Joined / Requested — Nextdoor's model. */
export function GroupJoinButton({
  group,
  onChange,
  size = "sm",
}: {
  group: Group;
  onChange: (membership: Group["membership"]) => void;
  size?: "sm" | "default";
}) {
  const { user, runGatedAction } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<void>) =>
    runGatedAction(async () => {
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        toast.error(errorMessage(err, "Something went wrong."));
      } finally {
        setBusy(false);
      }
    });

  if (group.membership === "member") {
    return (
      <Button
        variant="outline"
        size={size}
        loading={busy}
        onClick={() =>
          run(async () => {
            await leaveGroup(user!, group._id);
            onChange("none");
            toast.success(`You left ${group.name}.`);
          })
        }
      >
        <Check className="size-4" /> Joined
      </Button>
    );
  }

  if (group.membership === "requested") {
    return (
      <Button
        variant="outline"
        size={size}
        loading={busy}
        onClick={() =>
          run(async () => {
            await leaveGroup(user!, group._id);
            onChange("none");
          })
        }
        title="Cancel request"
      >
        <Clock className="size-4" /> Requested
      </Button>
    );
  }

  return (
    <Button
      size={size}
      loading={busy}
      onClick={() =>
        run(async () => {
          const membership = await joinGroup(user!, group);
          onChange(membership);
          toast.success(
            membership === "member"
              ? `Welcome to ${group.name}!`
              : "Request sent. A group lead will review it.",
          );
        })
      }
    >
      {group.privacy === "private" ? <Lock className="size-4" /> : <Plus className="size-4" />}
      {group.privacy === "private" ? "Request" : "Join"}
    </Button>
  );
}
