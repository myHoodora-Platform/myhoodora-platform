"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PROMPT_ACTIONS, PROMPT_FEATURES, type AdminPrompt, type PromptSettings, type PromptStatus, type SignalKey } from "@myhoodora/api-contract/prompts";
import { MessageSquareHeart, Plus, Star, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody, Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getPromptSettings, listPrompts, updatePromptSettings } from "@/lib/api/admin/prompts";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";

export const KIND_LABEL: Record<AdminPrompt["kind"], string> = { stars: "Stars", thumbs: "Thumbs", poll: "Poll", nps: "Would you recommend (0–10)", open: "Open question" };

/** "After they mark a listing sold (1st time)", "On app open", "Sent by hand". */
export function triggerLabel(p: Pick<AdminPrompt, "triggerType" | "triggerKey" | "triggerCount" | "sentAt">): string {
  if (p.triggerType === "open") return "Next time they open the app";
  if (p.triggerType === "manual") return p.sentAt ? "Sent by hand" : "Send by hand (not sent yet)";
  const nth = p.triggerCount === 1 ? "" : ` (${p.triggerCount}${ordinal(p.triggerCount)} time)`;
  if (p.triggerType === "action") return `After they ${(PROMPT_ACTIONS[p.triggerKey as keyof typeof PROMPT_ACTIONS] ?? "act").toLowerCase()}${nth}`;
  return `After using ${PROMPT_FEATURES[p.triggerKey as keyof typeof PROMPT_FEATURES] ?? "a feature"}${p.triggerCount > 1 ? ` ${p.triggerCount} times` : ""}`;
}
const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");

const TABS: { id: PromptStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Live" },
  { id: "draft", label: "Drafts" },
  { id: "paused", label: "Paused" },
  { id: "ended", label: "Ended" },
];

/** `/admin/feedback`: the questions we ask neighbours, how many answered, and when the app asks for store reviews. */
export function PromptsPage() {
  const { can } = useAdminSession();
  const [tab, setTab] = useState<PromptStatus | "all">("all");
  const prompts = useAdminQuery((u) => listPrompts(u, { status: tab }), `prompts:${tab}`);
  if (!can("feedback.manage")) return <Unauthorized message="Feedback prompts are managed by admins." />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Support" }, { label: "Feedback" }]}
        title="Feedback"
        description="Short questions neighbours answer in the app: after something they did, when they open it, or sent by hand. Ask little, at the right moment."
        actions={
          <Link href="/admin/feedback/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden /> New question
          </Link>
        }
      />

      <div role="tablist" aria-label="Status" className="flex w-fit flex-wrap gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        {prompts.error ? (
          <AdminProblem error={prompts.error} onRetry={() => void prompts.refetch()} />
        ) : !prompts.data ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : prompts.data.length === 0 ? (
          <EmptyBody icon={MessageSquareHeart} title={tab === "all" ? "No questions yet" : "Nothing here"} description={tab === "all" ? "Ask neighbours how something went: stars, thumbs, a poll, 0–10, or an open question." : "Try another tab."} />
        ) : (
          <ul className="divide-y divide-border">
            {prompts.data.map((p) => (
              <li key={p._id}>
                <Link href={`/admin/feedback/${p._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted/40">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">{p.emoji || <Star className="size-4 text-primary" aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {KIND_LABEL[p.kind]} · {triggerLabel(p)}
                    </span>
                  </span>
                  <StatusBadge status={p.effectiveStatus} label={p.effectiveStatus === "active" ? "Live" : undefined} />
                  <span className="w-40 text-right text-sm tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{(p.responses ?? 0).toLocaleString()}</span> answers · {(p.shown ?? 0).toLocaleString()} saw it
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <SettingsPanel />
    </div>
  );
}

const SIGNALS: { key: SignalKey; label: string }[] = Object.entries(PROMPT_ACTIONS).map(([key, label]) => ({ key: key as SignalKey, label }));

/** How often anyone is asked anything, and when the app asks for an App Store / Play Store review. */
function SettingsPanel() {
  const { user } = useAuth();
  const settings = useAdminQuery(getPromptSettings, "prompt-settings");
  const [draft, setDraft] = useState<PromptSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const s = draft ?? settings.data;
  if (!s) return null;
  const set = (patch: Partial<PromptSettings>) => setDraft({ ...s, ...patch });
  const setStore = (patch: Partial<PromptSettings["storeReview"]>) => set({ storeReview: { ...s.storeReview, ...patch } });
  const save = async () => {
    if (!user || !draft) return;
    setSaving(true);
    try {
      settings.setData(
        await updatePromptSettings(user, {
          cooldownDays: draft.cooldownDays,
          storeReviewEnabled: draft.storeReview.enabled,
          storeReviewMilestones: draft.storeReview.milestones,
          storeReviewMinDaysSinceJoin: draft.storeReview.minDaysSinceJoin,
          storeReviewCooldownDays: draft.storeReview.cooldownDays,
        }),
      );
      setDraft(null);
      toast.success("Saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="How often">
        <Field label="Days between questions for one neighbour" htmlFor="pr-cooldown" hint="Questions you send by hand skip this. Around 14 days keeps people answering.">
          <input id="pr-cooldown" type="number" min={0} max={180} value={s.cooldownDays} onChange={(e) => set({ cooldownDays: Number(e.target.value) })} className={fieldInputClass} />
        </Field>
      </Panel>
      <Panel title="App Store and Play Store reviews">
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="size-4" checked={s.storeReview.enabled} onChange={(e) => setStore({ enabled: e.target.checked })} />
            Ask for a store review at good moments
          </label>
          <p className="text-muted-foreground">The phone shows its own rating card; we ask nothing first (Google Play forbids it), and the stores may skip it. It happens exactly at one of these moments:</p>
          <ul className="space-y-2">
            {s.storeReview.milestones.map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="shrink-0">The</span>
                <input type="number" min={1} max={1000} aria-label="Which time" value={m.count} onChange={(e) => setStore({ milestones: s.storeReview.milestones.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)) })} className={cn(fieldInputClass, "w-20")} />
                <span className="shrink-0">time they</span>
                <select value={m.key} aria-label="Action" onChange={(e) => setStore({ milestones: s.storeReview.milestones.map((x, j) => (j === i ? { ...x, key: e.target.value as SignalKey } : x)) })} className={fieldInputClass}>
                  {SIGNALS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label.toLowerCase()}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label="Remove" onClick={() => setStore({ milestones: s.storeReview.milestones.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {s.storeReview.milestones.length < 10 && (
            <Button size="sm" variant="outline" onClick={() => setStore({ milestones: [...s.storeReview.milestones, { key: "post_created", count: 5 }] })}>
              Add a moment
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Only after they've been here (days)" htmlFor="pr-min">
              <input id="pr-min" type="number" min={0} max={365} value={s.storeReview.minDaysSinceJoin} onChange={(e) => setStore({ minDaysSinceJoin: Number(e.target.value) })} className={fieldInputClass} />
            </Field>
            <Field label="Ask one person at most every (days)" htmlFor="pr-store-cool">
              <input id="pr-store-cool" type="number" min={30} max={730} value={s.storeReview.cooldownDays} onChange={(e) => setStore({ cooldownDays: Number(e.target.value) })} className={fieldInputClass} />
            </Field>
          </div>
        </div>
      </Panel>
      {draft && (
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            Save settings
          </Button>
        </div>
      )}
    </div>
  );
}
