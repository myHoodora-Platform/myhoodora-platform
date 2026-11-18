"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { INVITE_FLAG_LABELS, normaliseInviteCode, type InviteVia } from "@myhoodora/api-contract/invites";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Panel } from "@/components/admin/detail";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { getStaffInvite, markInviteReviewed, setInviter } from "@/lib/api/admin/invites";
import { isLive } from "@/lib/api/config";
import { dateLabel } from "@/components/admin/format";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

const VIA: Record<InviteVia, string> = {
  link: "their invite link",
  post: "a post they shared",
  badge: "their badge card",
  group: "a group link",
  qr: "a QR poster",
  code: "typing the code",
  asked: "“Who invited you?”",
};

type Dialog = "reassign" | "void" | "reviewed" | null;

/**
 * On a neighbour's staff page: their invite code, who invited them (and whether it looks like one person,
 * invite-flags.ts in the API), how many they brought. Admins can credit someone else, remove the credit,
 * or clear a flag; every change is audited (contract §40).
 */
export function InvitePanel({ uid, name }: { uid: string; name: string }) {
  const { user } = useAuth();
  const { can } = useAdminSession();
  const view = useAdminQuery((u) => getStaffInvite(u, uid), `invite:${uid}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [code, setCode] = useState("");
  if (!isLive("invites") || !view.data) return null;
  const v = view.data;
  const by = v.invitedBy;
  const manage = can("engagement.manage");
  const done = (message: string) => {
    toast.success(message);
    void view.refetch();
  };

  return (
    <Panel title="Invites">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Their code</dt>
          <dd className="font-mono font-semibold">{v.code ?? "Not made yet"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Brought in</dt>
          <dd>
            <Link href="/admin/invites" className="hover:underline">
              {v.verified} verified <span className="text-muted-foreground">/ {v.joined} joined</span>
            </Link>
          </dd>
        </div>
        <div className="border-t border-border pt-2">
          <dt className="text-muted-foreground">Invited by</dt>
          <dd className="mt-1">
            {by ? (
              <>
                <Link href={`/admin/neighbours/${by.uid}`} className="font-semibold hover:text-primary hover:underline">
                  {by.displayName}
                </Link>{" "}
                <span className="font-mono text-xs text-muted-foreground">{by.code}</span>
                <p className="text-xs text-muted-foreground">
                  Through {VIA[by.via] ?? by.via}, {dateLabel(by.at)}
                  {by.vouched ? " · inviter was verified" : ""}
                  {by.changedByStaff ? " · set by staff" : ""}
                  {by.reviewed ? " · flag reviewed" : ""}
                </p>
              </>
            ) : (
              <span className="text-muted-foreground">Nobody</span>
            )}
          </dd>
        </div>
      </dl>

      {v.flags.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Looks like one person
          </p>
          <ul className="mt-1 list-disc pl-5">
            {v.flags.map((f) => (
              <li key={f}>{INVITE_FLAG_LABELS[f]}</li>
            ))}
          </ul>
        </div>
      )}

      {manage && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog("reassign")}>
            {by ? "Credit someone else" : "Credit an inviter"}
          </Button>
          {by && (
            <Button size="sm" variant="outline" onClick={() => setDialog("void")}>
              Remove credit
            </Button>
          )}
          {v.code && (
            <Link href={`/i/${v.code}/poster`} target="_blank" className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
              Print their poster
            </Link>
          )}
          {by && v.flags.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setDialog("reviewed")}>
              It&apos;s fine
            </Button>
          )}
        </div>
      )}

      {dialog === "reassign" && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={by ? "Credit someone else" : "Credit an inviter"}
          consequence={`${name}'s invite counts for the neighbour whose code you enter${by ? `, not ${by.displayName}` : ""}. Recorded in the audit log.`}
          reasons={["They told us someone else invited them", "Entered the wrong code", "Offline challenge records"]}
          confirmLabel="Credit them"
          ready={Boolean(normaliseInviteCode(code))}
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            const r = await setInviter(user, uid, normaliseInviteCode(code)!, note ? `${reason}: ${note}` : reason);
            setCode("");
            done(`Credited to ${r.invitedBy?.name ?? "them"}.`);
          }}
        >
          <Field label="Inviter's code" htmlFor="reassign-code">
            <input id="reassign-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. ADA7K" className={`${fieldInputClass} font-mono uppercase`} maxLength={14} />
          </Field>
        </ActionDialog>
      )}
      {dialog === "void" && by && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="Remove the credit"
          consequence={`${by.displayName} stops getting credit for inviting ${name}. ${name} keeps their account. Recorded in the audit log.`}
          reasons={["Same person, second account", "Invite farming", "Asked by the neighbour", "Added by mistake"]}
          destructive
          confirmLabel="Remove credit"
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            await setInviter(user, uid, null, note ? `${reason}: ${note}` : reason);
            done("Credit removed.");
          }}
        />
      )}
      {dialog === "reviewed" && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="Mark as checked"
          consequence="The invite keeps counting and stops being flagged. Recorded in the audit log."
          reasons={["Family sharing a phone", "Same estate Wi-Fi", "Checked with the neighbours"]}
          confirmLabel="It's fine"
          onConfirm={async ({ reason, note }) => {
            if (!user) return;
            await markInviteReviewed(user, uid, note ? `${reason}: ${note}` : reason);
            done("Marked as checked.");
          }}
        />
      )}
    </Panel>
  );
}
