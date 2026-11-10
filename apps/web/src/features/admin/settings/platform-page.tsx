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
import { DEFAULT_HOODORA_AI, safeStudioUrl } from "@/lib/hoodora-ai";
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
  const studioUrlProblem = draft?.hoodoraAi && !safeStudioUrl(draft.hoodoraAi.studioUrl) ? "The AI Studio address must start with https://" : null;
  const save = async () => {
    if (!user || !draft) return;
    if (studioUrlProblem) {
      toast.error(studioUrlProblem);
      return;
    }
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
        description="How reports are routed, how long alerts stay live, where myHoodora AI links go, and where we're open."
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

            <HoodoraAiPanel value={draft.hoodoraAi ?? DEFAULT_HOODORA_AI} onChange={(hoodoraAi) => setDraft({ ...draft, hoodoraAi })} />

            <Panel title="App analytics question">
              <p className="mb-3 text-sm text-muted-foreground">
                The app asks once whether it may share which features someone uses. If they say no, it asks again after this many days. A yes is never asked again.
              </p>
              <label className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Ask again after a no, in days</span>
                <input
                  type="number"
                  min={0}
                  max={730}
                  step={1}
                  value={draft.analyticsReaskDays}
                  onChange={(e) => setDraft({ ...draft, analyticsReaskDays: Math.max(0, Math.min(730, Math.round(Number(e.target.value) || 0))) })}
                  className="h-9 w-24 rounded-lg border border-border bg-card px-2"
                />
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                Default 180 (six months, the benchmark European regulators use). 0 never asks again. Asking more often than every few months can count as pressure, which weakens the consent. Everyone is also asked again when the privacy policy changes what analytics collects.
              </p>
            </Panel>
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

type HoodoraAiLink = PlatformSettings["hoodoraAi"];

/** Where every "myHoodora AI" link goes: the website's footer, the /ai address and the app's menu. */
function HoodoraAiPanel({ value, onChange }: { value: HoodoraAiLink; onChange: (next: HoodoraAiLink) => void }) {
  const options: { target: HoodoraAiLink["target"]; label: string; hint: string }[] = [
    { target: "studio", label: "AI Studio", hint: value.studioUrl.replace(/^https:\/\//, "").replace(/\/$/, "") },
    { target: "page", label: "myHoodora AI page", hint: "myhoodora.com/ai, with the pilot sign-up form" },
  ];
  const invalid = !safeStudioUrl(value.studioUrl);
  return (
    <Panel title="myHoodora AI link">
      <p className="mb-3 text-sm text-muted-foreground">
        Where &ldquo;myHoodora AI&rdquo; takes people from the website&apos;s footer, the myhoodora.com/ai address and the app&apos;s menu.
      </p>
      <div role="radiogroup" aria-label="myHoodora AI link goes to" className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = value.target === o.target;
          return (
            <button
              key={o.target}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, target: o.target })}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/60"}`}
            >
              <span className="block font-semibold">{o.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <label className="mt-4 block text-sm">
        <span className="font-medium">AI Studio address</span>
        <input
          type="url"
          inputMode="url"
          value={value.studioUrl}
          onChange={(e) => onChange({ ...value, studioUrl: e.target.value.trim() })}
          aria-invalid={invalid}
          className={`mt-1 h-9 w-full rounded-lg border bg-card px-2 ${invalid ? "border-destructive" : "border-border"}`}
        />
      </label>
      <p className={`mt-2 text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
        {invalid ? "Must start with https://" : "Kept when you switch to the page, so switching back is one click. Changes reach everyone within about a minute."}
      </p>
    </Panel>
  );
}
