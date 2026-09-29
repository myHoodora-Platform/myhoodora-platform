import { Ban, CheckCircle2, CircleDot, Eye, Flag, MailCheck, Megaphone, ShieldAlert, ShieldCheck, Trash2, Undo2, UserCog } from "lucide-react";
import type { AuditAction, AuditEvent } from "@/lib/api/admin/types";
import { dateTimeLabel, timeAgo } from "./format";

const VERB: Partial<Record<AuditAction, string>> = {
  keep: "kept (no violation)",
  remove_content: "removed",
  restore_content: "restored",
  warn_author: "warned the author of",
  restrict_author: "restricted",
  suspend_author: "suspended",
  escalate: "escalated",
  verify: "verified",
  reject_verification: "rejected verification for",
  change_hood: "moved",
  warn: "warned",
  restrict: "restricted",
  suspend: "suspended",
  reinstate: "reinstated",
  hood_create: "created the Hood",
  hood_update: "updated the Hood",
  hood_archive: "archived the Hood",
  business_approve: "approved",
  business_request_info: "asked for more info from",
  business_reject: "rejected",
  business_suspend: "suspended the page",
  broadcast_send: "sent the broadcast",
  role_change: "changed the role of",
  alert_end: "ended the alert",
  alert_downgrade: "downgraded the urgent alert",
  inbox_reply: "replied to",
  claim: "started reviewing",
  settings_update: "updated",
  lead_appoint: "made a Hood Lead in",
  lead_remove: "removed a Hood Lead from",
  appeal_filed: "appealed the decision on",
  appeal_upheld: "upheld the decision on",
  appeal_overturned: "overturned the decision on",
  business_claim: "claimed the Business Page",
};

const ICON: Partial<Record<AuditAction, React.ComponentType<{ className?: string }>>> = {
  remove_content: Trash2,
  restore_content: Undo2,
  keep: CheckCircle2,
  verify: ShieldCheck,
  restrict: ShieldAlert,
  restrict_author: ShieldAlert,
  suspend: Ban,
  suspend_author: Ban,
  escalate: Flag,
  claim: Eye,
  broadcast_send: Megaphone,
  role_change: UserCog,
  inbox_reply: MailCheck,
};

export function auditSentence(e: AuditEvent) {
  return `${e.actor.displayName} ${VERB[e.action] ?? e.action.replace(/_/g, " ")} ${e.target.label}`;
}

/** What already happened here, newest first. */
export function Timeline({ events, empty = "Nothing has happened here yet." }: { events: AuditEvent[]; empty?: string }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
      {events.map((e) => {
        const Icon = ICON[e.action] ?? CircleDot;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-semibold">{e.actor.displayName}</span> {VERB[e.action] ?? e.action.replace(/_/g, " ")}{" "}
                <span className="font-medium">{e.target.label}</span>
              </p>
              {(e.reason || e.note) && (
                <p className="mt-0.5 text-muted-foreground">
                  {e.reason}
                  {e.note ? ` · “${e.note}”` : ""}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground" title={dateTimeLabel(e.at)}>
                {timeAgo(e.at)} · {e.actor.role}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
