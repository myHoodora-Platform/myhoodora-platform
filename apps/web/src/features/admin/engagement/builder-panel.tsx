"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { badgeLabel } from "@myhoodora/api-contract/engagement";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Panel } from "@/components/admin/detail";
import { ParticipationBadge } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { getPersonEngagement, setBuilder } from "@/lib/api/engagement";
import { isLive } from "@/lib/api/config";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

/** On a neighbour's staff page: their streak, challenge progress and Hood Builder badge; admins grant or take it (audited). */
export function BuilderPanel({ uid, name }: { uid: string; name: string }) {
  const { user } = useAuth();
  const { can } = useAdminSession();
  const view = useAdminQuery((u) => getPersonEngagement(u, uid), `engagement:${uid}`);
  const [dialog, setDialog] = useState<"grant" | "revoke" | null>(null);
  if (!isLive("invites") || !view.data) return null;
  const e = view.data;
  const c = e.challenge;
  return (
    <Panel title="Launch challenge">
      <div className="flex items-center gap-3 text-sm">
        {e.badge && (
          <span className="relative size-9 shrink-0">
            <ParticipationBadge badge={e.badge} size="xl" />
          </span>
        )}
        <div>
          <p className="font-semibold">{c?.builder ? "Hood Builder" : "Not a Hood Builder yet"}</p>
          <p className="text-xs text-muted-foreground">{badgeLabel(e.badge) ?? "No badge"}</p>
        </div>
      </div>
      {c && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/60 p-2">
            <dd className="text-lg font-bold">{c.invites}</dd>
            <dt className="text-muted-foreground">verified invites</dt>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dd className="text-lg font-bold">{c.activeDays}</dd>
            <dt className="text-muted-foreground">active days</dt>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dd className="text-lg font-bold">{e.streak?.current ?? 0}</dd>
            <dt className="text-muted-foreground">day streak</dt>
          </div>
        </dl>
      )}
      {can("engagement.manage") && (
        <div className="mt-3">
          {c?.builder ? (
            <Button size="sm" variant="outline" onClick={() => setDialog("revoke")}>
              Take the badge away
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDialog("grant")}>
              Make them a Hood Builder
            </Button>
          )}
        </div>
      )}
      {dialog && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={dialog === "grant" ? "Make them a Hood Builder" : "Take the Hood Builder badge away"}
          consequence={dialog === "grant" ? `${name} gets the Hood Builder badge on their avatar straight away. Recorded in the audit log.` : `${name}'s badge goes, and doesn't come back by itself even if they qualify again. Recorded in the audit log.`}
          reasons={dialog === "grant" ? ["Hood Lead chosen offline", "Moderator", "Ran an offline event for the challenge"] : ["Invite farming", "Spam to reach the days", "Asked by the neighbour", "Given by mistake"]}
          destructive={dialog === "revoke"}
          confirmLabel={dialog === "grant" ? "Give the badge" : "Take it away"}
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            await setBuilder(user, uid, dialog === "grant", note ? `${reason}: ${note}` : reason);
            toast.success(dialog === "grant" ? "Badge given." : "Badge taken away.");
            void view.refetch();
          }}
        />
      )}
    </Panel>
  );
}
