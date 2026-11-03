"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, Unauthorized } from "@/components/admin/admin-states";
import { StatusTabs } from "@/components/admin/admin-toolbar";
import { Panel } from "@/components/admin/detail";
import { timeAgo } from "@/components/admin/format";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getPlatformSettings, listSignups, updatePlatformSettings } from "@/lib/api/admin/platform";
import type { PlatformSettings, ReportSeverity, SignupEntry } from "@/lib/api/admin/types";
import { ALERT_ACTIVE_HOURS, URGENT_WINDOW_HOURS } from "@/features/alerts/lifecycle";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

export function PlatformPage() {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const settings = useAdminQuery(getPlatformSettings, "settings");
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [signupType, setSignupType] = useState<SignupEntry["type"]>("ai_pilot");
  const signups = useAdminQuery((u) => listSignups(u, signupType), signupType);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (!can("settings.manage")) return <Unauthorized message="Only admins can change platform settings." />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);
  const save = async () => {
    if (!user || !draft) return;
    setSaving(true);
    try {
      settings.setData(await updatePlatformSettings(user, draft, role));
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Settings" }, { label: "Platform" }]}
        title="Platform settings"
        description="How reports are routed, how long alerts stay live, and where we're open."
        actions={
          dirty && (
            <Button size="sm" onClick={() => void save()} loading={saving}>
              Save changes
            </Button>
          )
        }
      />

      {settings.error && !settings.data ? (
        <AdminProblem error={settings.error} onRetry={settings.refetch} />
      ) : (
        draft && (
          <>
            <Panel title="Report reasons" padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <th className="px-5 py-3">Reason neighbours pick</th>
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">Staff only</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.reportReasons.map((r, i) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium">{r.label}</td>
                        <td className="px-5 py-3">
                          <select
                            aria-label={`Severity for ${r.label}`}
                            value={r.severity}
                            onChange={(e) =>
                              setDraft({ ...draft, reportReasons: draft.reportReasons.map((x, j) => (j === i ? { ...x, severity: e.target.value as ReportSeverity } : x)) })
                            }
                            className="h-9 rounded-lg border border-border bg-card px-2"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            aria-label={`${r.label} is staff only`}
                            checked={r.staffOnly}
                            onChange={(e) => setDraft({ ...draft, reportReasons: draft.reportReasons.map((x, j) => (j === i ? { ...x, staffOnly: e.target.checked } : x)) })}
                            className="size-4 accent-[var(--primary)]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Staff-only reasons skip volunteer review (Nextdoor sends discrimination, misinformation and account reports straight to staff). Severity sets queue order.
              </p>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Alert windows">
                <p className="mb-3 text-sm text-muted-foreground">
                  How long an alert stays live before it becomes a normal post. Urgent alerts show a red banner for {URGENT_WINDOW_HOURS} hours.
                </p>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(ALERT_ACTIVE_HOURS).map(([k, h]) => (
                    <li key={k} className="flex justify-between rounded-lg bg-muted/60 px-3 py-2">
                      <span className="capitalize">{k}</span>
                      <span className="font-semibold">{h >= 48 ? `${h / 24} days` : `${h}h`}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Editing these is planned (API returns activeUntil per alert).</p>
              </Panel>
              <Panel title="Coverage">
                <ul className="space-y-2 text-sm">
                  {draft.coverageCities.map((c) => (
                    <li key={c.city} className="flex justify-between rounded-lg bg-muted/60 px-3 py-2">
                      <span className="font-semibold">{c.city}</span>
                      <span>{c.hoods} Hoods</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Add a city by creating its first Hood.</p>
              </Panel>
            </div>
          </>
        )
      )}

      <Panel title="Sign-ups from the website" padded={false}>
        <div className="px-5 pt-3">
          <StatusTabs<SignupEntry["type"]>
            active={signupType}
            onChange={setSignupType}
            tabs={[
              { value: "ai_pilot", label: "myHoodora AI pilot" },
              { value: "talent", label: "Talent network" },
            ]}
          />
        </div>
        {!signups.data ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : signups.data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No sign-ups yet. They appear here when people submit the form on {signupType === "ai_pilot" ? "/ai" : "/careers"}.</p>
        ) : (
          <ul className="divide-y divide-border">
            {signups.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{s.name}</span> <span className="text-muted-foreground">· {s.email}</span>
                  <span className="block text-xs text-muted-foreground capitalize">{s.detail.replace(/_/g, " ")}</span>
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(s.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
