"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@myhoodora/ui/dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionDialog } from "@/components/admin/action-dialog";
import { AdminProblem, Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { initials, timeAgo } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { listNeighbours } from "@/lib/api/admin/community";
import { listTeam, setTeamRole } from "@/lib/api/admin/platform";
import type { AdminNeighbour } from "@/lib/api/admin/types";
import { ROLE_CAPABILITIES } from "@/lib/api/admin/session";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

type StaffRole = "member" | "moderator" | "admin";

const CAPABILITY_LABEL: Record<string, string> = {
  "moderation.act": "Review reports, remove content, warn and restrict (up to 7 days)",
  "moderation.suspend": "Suspend accounts and restrict for longer",
  "verification.review": "Approve or reject address verification",
  "hoods.manage": "Create, edit, pause and archive Hoods",
  "businesses.review": "Approve and suspend Business Pages",
  "broadcasts.send": "Send broadcasts",
  "team.manage": "Manage staff roles",
  "settings.manage": "Change platform settings",
};

export function TeamPage() {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const team = useAdminQuery(listTeam, "team");
  const [change, setChange] = useState<{ person: Pick<AdminNeighbour, "uid" | "displayName" | "role">; to: StaffRole } | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminNeighbour[]>([]);

  if (!can("team.manage")) return <Unauthorized message="Only admins can manage the team." />;

  const find = async (q: string) => {
    setSearch(q);
    if (!user || q.trim().length < 2) return setResults([]);
    const page = await listNeighbours(user, { q, role: "member", pageSize: 5 });
    setResults(page.items);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Settings" }, { label: "Team & roles" }]}
        title="Team & roles"
        description="Who can use the admin, and what each role can do. The API enforces these permissions on every request."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden /> Add staff
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(["moderator", "admin"] as const).map((r) => (
          <Panel key={r} title={<span className="capitalize">{r}s can</span>}>
            <ul className="space-y-1.5 text-sm">
              {ROLE_CAPABILITIES[r].map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-primary" aria-hidden>
                    ✓
                  </span>
                  {CAPABILITY_LABEL[c]}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel title="Staff" padded={false}>
        {team.error && !team.data ? (
          <div className="p-5">
            <AdminProblem error={team.error} onRetry={team.refetch} />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(team.data ?? []).map((p) => (
              <li key={p.uid} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(p.displayName)}</span>
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/neighbours/${p.uid}`} className="block font-semibold hover:underline">
                    {p.displayName} {p.uid === user?.uid && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {p.email} · active {p.lastActiveAt ? timeAgo(p.lastActiveAt) : "—"}
                  </span>
                </span>
                <StatusBadge status={p.role} />
                <select
                  aria-label={`Change ${p.displayName}'s role`}
                  value={p.role}
                  onChange={(e) => setChange({ person: p, to: e.target.value as StaffRole })}
                  className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="member">Remove from team</option>
                </select>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={adding} onOpenChange={(o) => !o && (setAdding(false), setSearch(""), setResults([]))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>Find a neighbour. New staff start as moderators; you can make them an admin afterwards.</DialogDescription>
          </DialogHeader>
          <input value={search} onChange={(e) => void find(e.target.value)} placeholder="Name or email" aria-label="Find a neighbour" className={fieldInputClass} autoFocus />
          <ul className="divide-y divide-border rounded-xl border border-border">
            {results.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">{search.trim().length < 2 ? "Type at least 2 letters." : "No members match."}</li>
            ) : (
              results.map((r) => (
                <li key={r.uid} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {r.displayName} <span className="text-muted-foreground">· {r.hood?.name ?? "No Hood"}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdding(false);
                      setChange({ person: r, to: "moderator" });
                    }}
                  >
                    Make moderator
                  </Button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      {change && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setChange(null)}
          title={change.to === "member" ? `Remove ${change.person.displayName} from the team` : `Make ${change.person.displayName} ${change.to === "admin" ? "an admin" : "a moderator"}`}
          consequence={
            change.to === "member"
              ? "They lose access to the admin immediately. Their past actions stay in the history."
              : `They can: ${ROLE_CAPABILITIES[change.to].map((c) => CAPABILITY_LABEL[c]!.toLowerCase()).join("; ")}.`
          }
          requireReason={false}
          destructive={change.to === "member"}
          confirmLabel="Confirm"
          onConfirm={async () => {
            if (!user) return;
            await setTeamRole(user, change.person.uid, change.to, role);
            toast.success("Role updated");
            void team.refetch();
          }}
        />
      )}
    </div>
  );
}
