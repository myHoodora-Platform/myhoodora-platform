"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Home,
  MapPin,
  MessageSquare,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@myhoodora/ui/dialog";
import { Skeleton } from "@myhoodora/ui/skeleton";
import type {
  HoodRequestKind,
  HoodRequestStatus,
} from "@myhoodora/api-contract/types";
import { ActionDialog } from "@/components/admin/action-dialog";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { AdminToolbar, StatusTabs } from "@/components/admin/admin-toolbar";
import { Pager } from "@/components/admin/data-table";
import { timeAgo } from "@/components/admin/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import {
  approveHoodRequest,
  declineHoodRequest,
  listHoodRequests,
  messageAboutHoodRequest,
  type AdminHoodRequest,
} from "@/lib/api/admin/hood-requests";
import { errorMessage } from "@/lib/api/client";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { HoodPicker } from "./hood-picker";

const DECLINE_REASONS = [
  "No clear link to the area",
  "Please tell us more first",
  "The address isn't in our coverage",
  "Duplicate request",
];

const KIND_LABEL: Record<HoodRequestKind, string> = {
  secondary: "Follow another neighbourhood",
  move: "Move home",
};

type Pending = {
  kind: "approve" | "decline" | "message";
  r: AdminHoodRequest;
} | null;

/**
 * Neighbourhood requests (contract §31): verified neighbours asking to follow another Hood (read and
 * alerts, up to two) or to move home. Neighbours never change Hoods themselves; staff decide here, and
 * can ask for more in a support conversation that lands in the neighbour's Messages.
 */
export function HoodRequestsPage() {
  const { can } = useAdminSession();
  const { get, set, page, key } = useListParams<"status" | "kind">({
    status: "pending",
    kind: "all",
  });
  const status = get("status") as HoodRequestStatus;
  const kind = get("kind") as HoodRequestKind | "all";
  const list = useAdminQuery(
    (u) =>
      listHoodRequests(u, {
        status,
        kind: kind === "all" ? undefined : kind,
        page,
      }),
    key,
    // New requests and withdrawals appear without a reload.
    ["queue.changed"],
  );
  const [pending, setPending] = useState<Pending>(null);
  const done = () => void list.refetch();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Community" }, { label: "Neighbourhood requests" }]}
        title="Neighbourhood requests"
        description="Neighbours asking to follow another neighbourhood (read and alerts only, up to two) or to move home. Oldest first."
      />
      <StatusTabs
        active={status}
        onChange={(v) => set({ status: v })}
        tabs={[
          { value: "pending", label: "Waiting" },
          { value: "approved", label: "Approved" },
          { value: "declined", label: "Declined" },
          { value: "removed", label: "Removed" },
          { value: "withdrawn", label: "Withdrawn" },
        ]}
      />
      <AdminToolbar
        count={
          list.data
            ? `${list.data.total} ${status === "pending" ? "waiting" : status}`
            : undefined
        }
      >
        <select
          value={kind}
          onChange={(e) => set({ kind: e.target.value })}
          className={`${fieldInputClass} max-w-xs`}
          aria-label="Kind of request"
        >
          <option value="all">All requests</option>
          <option value="secondary">Follow another neighbourhood</option>
          <option value="move">Move home</option>
        </select>
      </AdminToolbar>

      {list.error && !list.data ? (
        <AdminProblem error={list.error} onRetry={list.refetch} />
      ) : !list.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : list.data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyBody
            icon={MapPinned}
            title={status === "pending" ? "No one is waiting" : "Nothing here"}
            description="Requests to follow another neighbourhood or to move will appear here."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.items.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/neighbours/${r.neighbour.uid}`}
                      className="font-bold hover:text-primary hover:underline"
                    >
                      {r.neighbour.displayName}
                    </Link>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {KIND_LABEL[r.kind]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Home
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {r.home?.name ?? "No home neighbourhood"}
                    <ArrowRightLeft
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <strong>
                      {r.hood
                        ? `${r.hood.name}${r.hood.city ? `, ${r.hood.city}` : ""}`
                        : "Outside every neighbourhood"}
                    </strong>
                    {r.kind === "secondary" && (
                      <span className="text-xs text-muted-foreground">
                        · follows {r.secondaryCount} already
                      </span>
                    )}
                  </p>
                  {r.address && (
                    <p className="flex items-start gap-1.5 text-sm">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      {r.address}
                      {r.point && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {r.point.lat.toFixed(4)}, {r.point.lng.toFixed(4)}
                        </span>
                      )}
                    </p>
                  )}
                  <blockquote className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    “{r.reason}”
                  </blockquote>
                  {r.decisionNote && (
                    <p className="text-sm text-muted-foreground">
                      Told the neighbour: {r.decisionNote}
                    </p>
                  )}
                  {r.decidedBy && (
                    <p className="text-xs text-muted-foreground">
                      {r.status} by {r.decidedBy}
                      {r.decidedAt ? ` · ${timeAgo(r.decidedAt)}` : ""}
                    </p>
                  )}
                  {r.threadId && (
                    <Link
                      href={`/admin/inbox/${r.threadId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      <MessageSquare className="size-4" aria-hidden /> Open the
                      conversation
                    </Link>
                  )}
                </div>
                {r.status === "pending" && can("verification.review") && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setPending({ kind: "approve", r })}
                    >
                      {r.kind === "move"
                        ? r.hood
                          ? `Move to ${r.hood.name}`
                          : "Move…"
                        : `Approve ${r.hood?.name ?? ""}`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPending({ kind: "message", r })}
                    >
                      Ask for more
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPending({ kind: "decline", r })}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.data && (
        <Pager page={list.data} onPage={(p) => set({ page: String(p) })} />
      )}

      {pending?.kind === "approve" && (
        <ApproveDialog
          r={pending.r}
          onClose={() => setPending(null)}
          onDone={done}
        />
      )}
      {pending?.kind === "decline" && (
        <DeclineDialog
          r={pending.r}
          onClose={() => setPending(null)}
          onDone={done}
        />
      )}
      {pending?.kind === "message" && (
        <MessageDialog
          r={pending.r}
          onClose={() => setPending(null)}
          onDone={done}
        />
      )}
    </div>
  );
}

function ApproveDialog({
  r,
  onClose,
  onDone,
}: {
  r: AdminHoodRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [hoodId, setHoodId] = useState(r.hood?.id ?? "");
  const move = r.kind === "move";
  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={move ? "Approve move" : "Approve follow"}
      consequence={
        move
          ? `${r.neighbour.displayName} moves home to the neighbourhood you choose. Their feed, posting and selling switch there; old posts stay where they were posted.`
          : `${r.neighbour.displayName} can read ${r.hood?.name ?? "this neighbourhood"} and hear its safety alerts. They still post, sell and message only at home.`
      }
      confirmLabel={move ? "Move" : "Approve"}
      ready={!move || Boolean(hoodId)}
      onConfirm={async ({ note }) => {
        if (!user) return;
        await approveHoodRequest(user, r.id, {
          note,
          hoodId: move && hoodId ? hoodId : undefined,
        });
        toast.success(
          move ? "Moved. They've been told." : "Approved. They've been told.",
        );
        onDone();
      }}
    >
      {move && (
        <HoodPicker
          value={hoodId}
          onChange={(h) => setHoodId(h.id)}
          preset={r.hood ?? undefined}
          currentId={r.home?.id}
          near={r.point}
        />
      )}
    </ActionDialog>
  );
}

function DeclineDialog({
  r,
  onClose,
  onDone,
}: {
  r: AdminHoodRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Decline request"
      consequence={`${r.neighbour.displayName} is told it wasn't approved, with the reason you choose. They can ask again.`}
      reasons={DECLINE_REASONS}
      destructive
      confirmLabel="Decline"
      onConfirm={async ({ reason, note }) => {
        if (!user) return;
        await declineHoodRequest(user, r.id, { reason, note });
        toast.success("Declined. They've been told why.");
        onDone();
      }}
    />
  );
}

/** "Ask for more": a message in a support conversation about this request, pinned in their Messages. */
function MessageDialog({
  r,
  onClose,
  onDone,
}: {
  r: AdminHoodRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState(
    r.kind === "move"
      ? `Hi ${r.neighbour.displayName.split(" ")[0]}, thanks for asking to move. `
      : `Hi ${r.neighbour.displayName.split(" ")[0]}, thanks for asking to follow ${r.hood?.name ?? "this neighbourhood"}. `,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!user) return;
    setSending(true);
    setError(null);
    try {
      await messageAboutHoodRequest(user, r.id, body.trim());
      toast.success("Sent. It's in their Messages, and in the support inbox.");
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't send that."));
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask {r.neighbour.displayName} for more</DialogTitle>
          <DialogDescription>
            {r.threadId
              ? "Adds to the conversation you already started about this request."
              : "Starts a conversation about this request. They'll get a notification and an email, and reply in the app."}
          </DialogDescription>
        </DialogHeader>
        <Field label="Message" htmlFor="hood-request-message">
          <textarea
            id="hood-request-message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={4000}
            className={fieldInputClass}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => void send()}
            loading={sending}
            disabled={body.trim().length < 2}
          >
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
