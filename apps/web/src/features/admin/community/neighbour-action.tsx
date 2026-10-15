"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionDialog } from "@/components/admin/action-dialog";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { bulkFailureSummary } from "@/lib/api/admin/bulk-outcome";
import { actOnNeighbour, bulkNeighbours } from "@/lib/api/admin/community";
import type { NeighbourAction } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { HoodPicker } from "./hood-picker";

const SPEC: Record<NeighbourAction, { title: string; confirm: string; destructive?: boolean; reasons: string[]; consequence: (who: string) => string }> = {
  verify: {
    title: "Verify neighbour",
    confirm: "Verify",
    reasons: ["Address matched manually", "Estate / association confirmed", "Utility bill checked", "Known to Hood lead"],
    consequence: (who) => `${who} joins the Hood you choose and can post, comment and use alerts, events, groups and For Sale & Free.`,
  },
  change_hood: {
    title: "Move to another Hood",
    confirm: "Move",
    reasons: ["Moved house", "Matched to the wrong Hood", "Boundary change"],
    consequence: (who) => `${who}'s feed switches to the new Hood. Their old posts stay where they were posted.`,
  },
  reject_verification: {
    title: "Reject verification",
    confirm: "Reject",
    destructive: true,
    reasons: ["Address outside our coverage", "Address doesn't exist", "Suspected fake account", "Duplicate account"],
    consequence: (who) => `${who} stays unverified with limited access, and sees guidance on how to try again.`,
  },
  warn: {
    title: "Send a warning",
    confirm: "Send warning",
    reasons: ["Hurtful comments", "Spam or advertising", "Off-topic posting", "Breaking group rules"],
    consequence: (who) => `${who} gets a private message quoting the guideline. It's recorded on their history.`,
  },
  restrict: {
    title: "Restrict account",
    confirm: "Restrict",
    destructive: true,
    reasons: ["Repeated violations", "Harassment", "Scam attempts", "Spam"],
    consequence: (who) => `${who} can still read and message, but can't post, comment or list items until the restriction ends.`,
  },
  suspend: {
    title: "Suspend account",
    confirm: "Suspend",
    destructive: true,
    reasons: ["Scam or fraud", "Serious harassment or threats", "Impersonation", "Repeated violations after restriction"],
    consequence: (who) => `${who} is signed out and can't use myHoodora until an admin reinstates them.`,
  },
  reinstate: {
    title: "Reinstate account",
    confirm: "Reinstate",
    reasons: ["Restriction served", "Appeal accepted", "Actioned in error"],
    consequence: (who) => `${who} gets full access back straight away.`,
  },
};

/** One dialog for every neighbour action, single or bulk. */
export function NeighbourActionDialog({
  action,
  targets,
  near,
  onClose,
  onDone,
}: {
  action: NeighbourAction | null;
  /** `hood`: their current Hood (or, from the verification queue, the one to approve them into). */
  targets: { uid: string; displayName: string; hood?: { id: string; name: string } }[];
  /** Their pin, to offer the nearest Hoods first. */
  near?: { lat: number; lng: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const [hoodId, setHoodId] = useState("");
  const [days, setDays] = useState("7");
  const needsHood = action === "verify" || action === "change_hood";

  // Reset only when a new action/target set opens (targets is a fresh array each render).
  const targetKey = targets.map((t) => t.uid).join(",");
  // Their current Hood: pre-selected when verifying, but never a "move" target.
  const currentHood = targets.length === 1 ? targets[0]!.hood : undefined;
  const firstHood = action === "change_hood" ? "" : (currentHood?.id ?? "");
  useEffect(() => {
    setHoodId(firstHood);
    setDays("7");
  }, [action, targetKey, firstHood]);

  if (!action) return null;
  const spec = SPEC[action];
  const who = targets.length === 1 ? targets[0]!.displayName : `These ${targets.length} neighbours`;

  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={targets.length > 1 ? `${spec.title} (${targets.length})` : spec.title}
      consequence={spec.consequence(who)}
      reasons={spec.reasons}
      destructive={spec.destructive}
      confirmLabel={spec.confirm}
      ready={!needsHood || Boolean(hoodId)}
      onConfirm={async ({ reason, note }) => {
        if (!user) return;
        const input = { action, reason, note, hoodId: needsHood ? hoodId : undefined, days: action === "restrict" ? Number(days) : undefined };
        if (targets.length === 1) await actOnNeighbour(user, targets[0]!.uid, input, role);
        else {
          // Each neighbour is handled on their own, so some can succeed while others don't.
          const outcome = await bulkNeighbours(user, targets.map((t) => t.uid), input, role);
          const problem = bulkFailureSummary(outcome, (uid) => targets.find((t) => t.uid === uid)?.displayName ?? "A neighbour");
          if (problem) {
            toast.warning(`${spec.confirm}: ${problem}`, { duration: 12_000 });
            onDone();
            return;
          }
        }
        toast.success(`${spec.confirm}: done. It's in the moderation history.`);
        onDone();
      }}
    >
      {needsHood && (
        <HoodPicker
          value={hoodId}
          onChange={(h) => setHoodId(h.id)}
          preset={action === "change_hood" ? undefined : currentHood}
          currentId={action === "change_hood" ? currentHood?.id : undefined}
          near={near}
        />
      )}
      {action === "restrict" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">For how long?</span>
          <select value={days} onChange={(e) => setDays(e.target.value)} className={fieldInputClass}>
            {["1", "3", "7", ...(can("moderation.suspend") ? ["14", "30"] : [])].map((d) => (
              <option key={d} value={d}>
                {d} {d === "1" ? "day" : "days"}
              </option>
            ))}
          </select>
        </label>
      )}
    </ActionDialog>
  );
}
