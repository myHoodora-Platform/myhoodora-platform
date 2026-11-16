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
import { checkAppStores, getPlatformSettings, listSignups, updatePlatformSettings } from "@/lib/api/admin/platform";
import type { PlatformSettings, ReportSeverity, SignupEntry } from "@/lib/api/admin/types";
import { ALERT_ACTIVE_HOURS, URGENT_WINDOW_HOURS } from "@/features/alerts/lifecycle";
import { DEFAULT_HOODORA_AI, safeStudioUrl } from "@/lib/hoodora-ai";
import { appVersionRuleProblem, DEFAULT_APP_UPDATES, DEFAULT_APP_UPDATES_AUTO, MAX_REQUIRE_AFTER_DAYS, minimumFollowsOn, NO_STORE_CHECK, type AppUpdatesAuto, type AppUpdatesDraft, type AppVersionRuleDraft } from "@/lib/app-updates";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

export function PlatformPage() {
  const { user } = useAuth();
  const { role, can } = useAdminSession();
  const settings = useAdminQuery(getPlatformSettings, "settings");
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [signupType, setSignupType] = useState<SignupEntry["type"]>("ai_pilot");
  const signups = useAdminQuery((u) => listSignups(u, signupType), signupType);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (!can("settings.manage")) return <Unauthorized message="Only admins can change platform settings." />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);
  const studioUrlProblem = draft?.hoodoraAi && !safeStudioUrl(draft.hoodoraAi.studioUrl) ? "The AI Studio address must start with https://" : null;
  const appUpdates = draft?.appUpdates ?? DEFAULT_APP_UPDATES;
  const appUpdatesProblem = draft ? (["android", "ios"] as const).map((p) => appVersionRuleProblem(appUpdates[p]) && `${PLATFORM_NAMES[p]}: ${appVersionRuleProblem(appUpdates[p])}`).find(Boolean) : null;
  const save = async () => {
    if (!user || !draft) return;
    const problem = studioUrlProblem ?? appUpdatesProblem;
    if (problem) {
      toast.error(problem);
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

  const checkStores = async () => {
    if (!user) return;
    setChecking(true);
    try {
      settings.setData(await checkAppStores(user, role));
      toast.success("Stores checked");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't check the stores."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Settings" }, { label: "Platform" }]}
        title="Platform settings"
        description="How reports are routed, how long alerts stay live, where myHoodora AI links go, when the app asks people to update, and where we're open."
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

            <AppUpdatesPanel
              value={appUpdates}
              auto={draft.appUpdatesAuto ?? DEFAULT_APP_UPDATES_AUTO}
              status={draft.appStoreStatus ?? { android: NO_STORE_CHECK, ios: NO_STORE_CHECK }}
              onChange={(next) => setDraft({ ...draft, appUpdates: next })}
              onAutoChange={(next) => setDraft({ ...draft, appUpdatesAuto: next })}
              onCheck={() => void checkStores()}
              checking={checking}
              dirty={dirty}
            />

            <BlockedWordsPanel value={draft.blockedTerms ?? []} onChange={(blockedTerms) => setDraft({ ...draft, blockedTerms })} />

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
    { target: "page", label: "myHoodora AI page", hint: "myhoodora.com/ai, our own page" },
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

const PLATFORM_NAMES = { android: "Android", ios: "iPhone" } as const;
const STORE_NAMES = { android: "Google Play", ios: "the App Store" } as const;

/**
 * Which store versions the app compares itself with. Below the latest: a "New version available" sheet
 * people can skip. Below the minimum: an "Update required" screen they can't get past. Latest can follow
 * the stores by itself, and Minimum can follow Latest after some days, so nobody has to remember.
 */
function AppUpdatesPanel({
  value,
  auto,
  status,
  onChange,
  onAutoChange,
  onCheck,
  checking,
  dirty,
}: {
  value: AppUpdatesDraft;
  auto: AppUpdatesAuto;
  status: PlatformSettings["appStoreStatus"];
  onChange: (next: AppUpdatesDraft) => void;
  onAutoChange: (next: AppUpdatesAuto) => void;
  onCheck: () => void;
  checking: boolean;
  dirty: boolean;
}) {
  const set = (p: keyof AppUpdatesDraft, patch: Partial<AppVersionRuleDraft>) => onChange({ ...value, [p]: { ...value[p], ...patch } });
  return (
    <Panel title="App updates">
      <p className="mb-4 text-sm text-muted-foreground">
        Below <span className="font-medium text-foreground">Latest</span>, the app offers the update and people can skip it. Below{" "}
        <span className="font-medium text-foreground">Minimum</span>, it shows a screen that only opens the store.
      </p>

      <div className="mb-4 space-y-3 rounded-xl bg-muted/60 p-4 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={auto.fromStores} onChange={(e) => onAutoChange({ ...auto, fromStores: e.target.checked })} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            <span className="block font-medium">Follow the stores</span>
            <span className="block text-xs text-muted-foreground">Every 6 hours, Latest rises to the version live in Google Play and the App Store. Google Play counts a release only once it reaches everyone.</span>
          </span>
        </label>
        <label className="flex flex-wrap items-center gap-3">
          <span className="font-medium">Require the update after</span>
          <input
            type="number"
            min={0}
            max={MAX_REQUIRE_AFTER_DAYS}
            step={1}
            value={auto.requireAfterDays}
            onChange={(e) => onAutoChange({ ...auto, requireAfterDays: Math.max(0, Math.min(MAX_REQUIRE_AFTER_DAYS, Math.round(Number(e.target.value) || 0))) })}
            className="h-9 w-20 rounded-lg border border-border bg-card px-2"
          />
          <span>days</span>
          <span className="basis-full text-xs text-muted-foreground">
            Minimum follows Latest this many days after Latest rises, never above what the store has. 0 leaves Minimum to you. Over-the-air updates never need this: phones get them by themselves.
          </span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["android", "ios"] as const).map((p) => {
          const rule = value[p];
          const problem = appVersionRuleProblem(rule);
          const field = "mt-1 h-9 w-full rounded-lg border bg-card px-2";
          const store = status[p];
          const follows = minimumFollowsOn(rule, auto);
          return (
            <fieldset key={p} className="rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{PLATFORM_NAMES[p]}</legend>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label>
                  <span className="font-medium">Latest</span>
                  <input value={rule.latest} placeholder="1.0.0" inputMode="decimal" onChange={(e) => set(p, { latest: e.target.value.trim() })} className={`${field} border-border`} />
                </label>
                <label>
                  <span className="font-medium">Minimum</span>
                  <input value={rule.minimum} placeholder="1.0.0" inputMode="decimal" onChange={(e) => set(p, { minimum: e.target.value.trim() })} className={`${field} border-border`} />
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Store page</span>
                <input
                  type="url"
                  inputMode="url"
                  value={rule.storeUrl}
                  placeholder={p === "ios" ? "https://apps.apple.com/app/id…" : "https://play.google.com/store/apps/details?id=…"}
                  onChange={(e) => set(p, { storeUrl: e.target.value.trim() })}
                  aria-invalid={Boolean(problem)}
                  className={`${field} ${problem ? "border-destructive" : "border-border"}`}
                />
              </label>
              <p className={`mt-2 text-xs ${problem ? "text-destructive" : "text-muted-foreground"}`}>
                {problem ?? (rule.storeUrl ? `Opens ${STORE_NAMES[p]}.` : `Empty until the app is in ${STORE_NAMES[p]}: nobody on ${PLATFORM_NAMES[p]} is asked to update. Filled in by itself once the store lists the app.`)}
              </p>
              <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">In {STORE_NAMES[p]}</dt>
                  <dd className="font-medium">{store.version ?? (store.checkedAt && !store.problem ? "Not listed yet" : "Unknown")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Last checked</dt>
                  <dd>{store.checkedAt ? timeAgo(store.checkedAt) : "Never"}</dd>
                </div>
                {follows && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Minimum becomes {rule.latest}</dt>
                    <dd>{follows.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
                  </div>
                )}
                {store.problem && <p className="text-destructive">{store.problem}</p>}
              </dl>
            </fieldset>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={onCheck} loading={checking} disabled={dirty}>
          Check the stores now
        </Button>
        <span className="text-xs text-muted-foreground">{dirty ? "Save your changes first." : "Changes reach phones the next time the app opens."}</span>
      </div>
    </Panel>
  );
}

/** Most words and phrases admins can add, and the longest (the API's limits). */
const MAX_BLOCKED_TERMS = 500;
const MAX_BLOCKED_TERM_LENGTH = 60;

/**
 * Words the content filter refuses on top of its built-in list (sexual content, slurs, the worst swear
 * words, threats to kill). One per line; "word*" also covers longer words that start with it.
 */
function BlockedWordsPanel({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const parse = (raw: string) => raw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, MAX_BLOCKED_TERMS);
  const [text, setText] = useState(value.join("\n"));
  // Follow the saved list (after Save or a reload) without fighting the cursor while typing.
  useEffect(() => setText((current) => (parse(current).join("\n") === value.join("\n") ? current : value.join("\n"))), [value]);
  const terms = parse(text);
  const tooLong = terms.find((t) => t.length > MAX_BLOCKED_TERM_LENGTH);
  return (
    <Panel title="Blocked words">
      <p className="mb-3 text-sm text-muted-foreground">
        Posts, comments, listings, messages, group names and profiles containing these are refused with &ldquo;Please rephrase&rdquo;. A built-in list already covers sexual content, slurs, the worst swear words and threats to kill; add local insults and anything else here.
      </p>
      <textarea
        value={text}
        rows={6}
        spellCheck={false}
        aria-label="Blocked words, one per line"
        placeholder={"one word or phrase per line\nolosho*"}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className={`w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm ${tooLong ? "border-destructive" : "border-border"}`}
      />
      <p className={`mt-2 text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
        {tooLong
          ? `"${tooLong.slice(0, 20)}…" is longer than ${MAX_BLOCKED_TERM_LENGTH} characters.`
          : `${terms.length} of ${MAX_BLOCKED_TERMS}. Whole words only, so "ode" won't catch "code". End with * to cover longer words too (olosho* also catches oloshos). Spelling tricks such as p0rn or f.u.c.k are caught. Changes apply within a minute.`}
      </p>
    </Panel>
  );
}
