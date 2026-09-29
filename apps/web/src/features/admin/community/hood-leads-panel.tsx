"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Panel } from "@/components/admin/detail";
import { initials, timeAgo } from "@/components/admin/format";
import { fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getHoodLeads, listNeighbours, setHoodLeads } from "@/lib/api/admin/community";
import type { AdminNeighbour } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

/** Voting on reports starts once a Hood has this many active Leads (matches the API). */
const MIN_LEADS = 3;

/**
 * Volunteer Hood Leads (Nextdoor model). They vote on low-risk reports in
 * their own Hood; high-risk reasons and account reports always come to staff.
 */
export function HoodLeadsPanel({ hoodId }: { hoodId: string }) {
  const { user } = useAuth();
  const { can } = useAdminSession();
  const leads = useAdminQuery((u) => getHoodLeads(u, hoodId), `leads-${hoodId}`);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminNeighbour[]>([]);
  const [saving, setSaving] = useState(false);
  const manage = can("hoods.manage");
  const current = leads.data ?? [];

  const save = async (uids: string[], done: string) => {
    if (!user) return;
    setSaving(true);
    try {
      await setHoodLeads(user, hoodId, uids);
      toast.success(done);
      setAdding(false);
      setQ("");
      setResults([]);
      void leads.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update Leads."));
    } finally {
      setSaving(false);
    }
  };

  const search = async (value: string) => {
    setQ(value);
    if (!user || value.trim().length < 2) return setResults([]);
    const page = await listNeighbours(user, { hoodId, q: value, verification: "verified", account: "active", pageSize: 6 });
    setResults(page.items.filter((n) => !current.some((l) => l.uid === n.uid)));
  };

  return (
    <Panel
      title="Hood Leads"
      action={
        manage && !adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden /> Add
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {current.length >= MIN_LEADS
            ? "Low-risk reports here go to a Lead vote first (3 votes, two-thirds majority, then staff after 48 h)."
            : `Voting starts at ${MIN_LEADS} Leads. Until then, every report comes to the staff queue.`}
        </p>
        {leads.loading ? (
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        ) : current.length === 0 ? (
          <p className="font-medium">No Leads yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {current.map((l) => (
              <li key={l.uid} className="flex items-center gap-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(l.displayName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.displayName}</span>
                  <span className="block text-xs text-muted-foreground">Lead since {timeAgo(l.since)}</span>
                </span>
                {manage && (
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={`Remove ${l.displayName} as a Lead`}
                    onClick={() => void save(current.filter((x) => x.uid !== l.uid).map((x) => x.uid), `${l.displayName} is no longer a Lead`)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <div className="space-y-2 border-t border-border pt-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => void search(e.target.value)}
              placeholder="Search verified neighbours in this Hood"
              aria-label="Search neighbours"
              className={fieldInputClass}
            />
            {results.map((n) => (
              <button
                key={n.uid}
                type="button"
                disabled={saving}
                onClick={() => void save([...current.map((l) => l.uid), n.uid], `${n.displayName} is now a Hood Lead`)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <span className="font-medium">{n.displayName}</span>
                <span className="text-xs font-semibold text-primary">Make Lead</span>
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => (setAdding(false), setQ(""), setResults([]))}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
