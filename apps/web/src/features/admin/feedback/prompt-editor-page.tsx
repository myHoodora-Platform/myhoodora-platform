"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PROMPT_ACCENTS, PROMPT_ACTIONS, PROMPT_FEATURES, type AdminPrompt, type AdminPromptInput, type PromptKind, type PromptLayout, type PromptResults, type SignalKey, type TriggerType } from "@myhoodora/api-contract/prompts";
import { Check, Download, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { ActionDialog } from "@/components/admin/action-dialog";
import { AdminProblem, DetailSkeleton, NotFound, Unauthorized } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { timeAgo } from "@/components/admin/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { ApiError, errorMessage } from "@/lib/api/client";
import { listHoods } from "@/lib/api/admin/community";
import { createPrompt, deletePrompt, downloadPromptCsv, getPrompt, getPromptResults, sendPrompt, setPromptStatus, updatePrompt } from "@/lib/api/admin/prompts";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { KIND_LABEL, triggerLabel } from "./prompts-page";
import { PromptPreview } from "./prompt-preview";

const KINDS: { id: PromptKind; hint: string; emoji: string }[] = [
  { id: "stars", hint: "Rate 1–5: how did something go?", emoji: "⭐" },
  { id: "thumbs", hint: "Yes or no, quick", emoji: "👍" },
  { id: "poll", hint: "Pick one of 2–6 choices", emoji: "🗳️" },
  { id: "nps", hint: "How likely to recommend us, 0–10", emoji: "📣" },
  { id: "open", hint: "A written answer", emoji: "✍️" },
];
const LAYOUTS: { id: PromptLayout; label: string; hint: string }[] = [
  { id: "sheet", label: "Sheet", hint: "Slides up from the bottom" },
  { id: "dialog", label: "Card", hint: "In the middle of the screen" },
  { id: "feed", label: "In the feed", hint: "At the top of the feed, no interruption" },
];
const TRIGGERS: { id: TriggerType; label: string; hint: string }[] = [
  { id: "action", label: "After an action", hint: "Right after they do something" },
  { id: "feature", label: "After using a feature", hint: "After the Nth visit" },
  { id: "open", label: "On app open", hint: "Next time they open the app" },
  { id: "manual", label: "Send now", hint: "You send it, optionally with a notification" },
];
const ACCENT_SWATCH: Record<string, string> = { green: "#E7F4EE", blue: "#E8F0FE", amber: "#FEF3C7", rose: "#FFE4E6", slate: "#F1F5F9" };
const EMPTY: AdminPromptInput = { title: "", kind: "stars", question: "", detail: "", options: [], commentMode: "optional", commentLabel: "", thanksMessage: "", layout: "sheet", accent: "green", emoji: "⭐", triggerType: "action", triggerKey: "listing_sold", triggerCount: 1, delaySeconds: 2, hoodIds: [], cities: [], minDaysSinceJoin: null, maxDaysSinceJoin: null, startsAt: null, endsAt: null, priority: 5, maxShows: 2, push: false };
const toLocalInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function inputOf(p: AdminPrompt): AdminPromptInput {
  const { title, kind, question, detail, options, commentMode, commentLabel, thanksMessage, layout, accent, emoji, triggerType, triggerKey, triggerCount, delaySeconds, hoodIds, cities, minDaysSinceJoin, maxDaysSinceJoin, startsAt, endsAt, priority, maxShows, push } = p;
  return { title, kind, question, detail, options, commentMode, commentLabel, thanksMessage, layout, accent, emoji, triggerType, triggerKey, triggerCount, delaySeconds, hoodIds, cities, minDaysSinceJoin, maxDaysSinceJoin, startsAt, endsAt, priority, maxShows, push };
}

/** What the API takes: empty strings left out, only what the kind and trigger use. */
function clean(f: AdminPromptInput): AdminPromptInput {
  const trigger = f.triggerType === "action" || f.triggerType === "feature";
  return {
    ...f,
    detail: f.detail || undefined,
    commentLabel: f.commentLabel || undefined,
    thanksMessage: f.thanksMessage || undefined,
    emoji: f.emoji || undefined,
    options: f.kind === "poll" ? f.options : [],
    commentMode: f.kind === "open" ? "required" : f.commentMode,
    triggerKey: trigger ? f.triggerKey : undefined,
    push: f.triggerType === "manual" ? f.push : false,
  };
}

/** `/admin/feedback/new` and `/admin/feedback/<id>`: the question, when and to whom, a phone preview to try, and the answers. */
export function PromptEditorPage({ id }: { id?: string }) {
  const { can } = useAdminSession();
  const loaded = useAdminQuery((u) => (id ? getPrompt(u, id) : Promise.resolve(null)), `prompt:${id ?? "new"}`);
  if (!can("feedback.manage")) return <Unauthorized message="Feedback prompts are managed by admins." />;
  if (id && loaded.error) {
    return loaded.error instanceof ApiError && loaded.error.status === 404 ? <NotFound backHref="/admin/feedback" message="That question doesn't exist or was deleted." /> : <AdminProblem error={loaded.error} onRetry={() => void loaded.refetch()} backHref="/admin/feedback" />;
  }
  if (id && !loaded.data) return <DetailSkeleton />;
  return <Editor key={id ?? "new"} prompt={loaded.data ?? undefined} onSaved={(p) => loaded.setData(p)} />;
}

function Editor({ prompt, onSaved }: { prompt?: AdminPrompt; onSaved: (p: AdminPrompt) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<AdminPromptInput>(() => (prompt ? inputOf(prompt) : EMPTY));
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"send" | "delete" | null>(null);
  const [aim, setAim] = useState<"everyone" | "hoods" | "cities">(() => (prompt?.hoodIds.length ? "hoods" : prompt?.cities.length ? "cities" : "everyone"));
  const hoods = useAdminQuery((u) => listHoods(u, { pageSize: 100, sort: "name:asc" }), "prompt-hoods");
  const set = (patch: AdminPromptInput) => setForm((f) => ({ ...f, ...patch }));
  const status = prompt?.effectiveStatus;
  const manual = form.triggerType === "manual";
  const payload = () => ({ ...clean(form), hoodIds: aim === "hoods" ? form.hoodIds : [], cities: aim === "cities" ? form.cities : [] });
  const ready = !!form.title?.trim() && !!form.question?.trim();

  const save = async (goLive: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      let saved = prompt ? await updatePrompt(user, prompt._id, payload()) : await createPrompt(user, payload());
      if (goLive && saved.effectiveStatus !== "active") saved = await setPromptStatus(user, saved._id, "active");
      toast.success(goLive ? "Saved. It's live." : prompt ? "Changes saved." : "Draft saved.");
      if (!prompt) router.replace(`/admin/feedback/${saved._id}`);
      else onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the question."));
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (next: "active" | "paused" | "ended") => {
    if (!user || !prompt) return;
    setSaving(true);
    try {
      onSaved(await setPromptStatus(user, prompt._id, next));
      toast.success(next === "active" ? "It's live." : next === "paused" ? "Paused." : "Ended.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Support" }, { label: "Feedback", href: "/admin/feedback" }, { label: prompt ? prompt.title : "New question" }]}
        title={prompt ? prompt.title : "New question"}
        meta={status && <StatusBadge status={status} label={status === "active" ? "Live" : undefined} />}
        description={prompt ? triggerLabel(prompt) : "Ask one thing, at the moment it matters. Every change is in the audit log."}
        actions={
          prompt && (
            <div className="flex flex-wrap gap-2">
              {manual && !prompt.sentAt && (
                <Button onClick={() => setConfirm("send")} disabled={saving}>
                  <Send className="size-4" /> Send now
                </Button>
              )}
              {status === "active" && !manual && (
                <Button variant="outline" onClick={() => void changeStatus("paused")} disabled={saving}>
                  Pause
                </Button>
              )}
              {status === "paused" && (
                <Button variant="outline" onClick={() => void changeStatus("active")} disabled={saving}>
                  Resume
                </Button>
              )}
              {status === "active" && (
                <Button variant="outline" onClick={() => void changeStatus("ended")} disabled={saving}>
                  End
                </Button>
              )}
              <Button variant="outline" onClick={() => setConfirm("delete")} disabled={saving} className="text-destructive">
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title="The question">
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Kind of answer</legend>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {KINDS.map((k) => (
                    <button key={k.id} type="button" aria-pressed={form.kind === k.id} onClick={() => set({ kind: k.id, emoji: form.emoji && KINDS.some((x) => x.emoji === form.emoji) ? k.emoji : form.emoji })} className={cn("rounded-xl border p-3 text-left text-sm", form.kind === k.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}>
                      <span className="block text-lg">{k.emoji}</span>
                      <span className="block font-semibold">{KIND_LABEL[k.id]}</span>
                      <span className="block text-xs text-muted-foreground">{k.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Field label="Question" htmlFor="pr-q" hint={`${form.question?.length ?? 0}/140`}>
                  <input id="pr-q" value={form.question ?? ""} maxLength={140} onChange={(e) => set({ question: e.target.value })} className={fieldInputClass} placeholder={form.kind === "nps" ? "How likely are you to recommend myHoodora to a neighbour?" : "How was selling on For Sale?"} />
                </Field>
                <Field label="Emoji" htmlFor="pr-emoji" optional>
                  <input id="pr-emoji" value={form.emoji ?? ""} maxLength={8} onChange={(e) => set({ emoji: e.target.value })} className={cn(fieldInputClass, "w-20 text-center text-lg")} />
                </Field>
              </div>
              <Field label="A line under it" htmlFor="pr-detail" optional>
                <input id="pr-detail" value={form.detail ?? ""} maxLength={240} onChange={(e) => set({ detail: e.target.value })} className={fieldInputClass} placeholder="It takes a few seconds and helps us improve." />
              </Field>
              {form.kind === "poll" && <OptionsEditor options={form.options ?? []} onChange={(options) => set({ options })} />}
              {form.kind !== "open" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Comment box" htmlFor="pr-comment">
                    <select id="pr-comment" value={form.commentMode} onChange={(e) => set({ commentMode: e.target.value as AdminPromptInput["commentMode"] })} className={fieldInputClass}>
                      <option value="optional">Optional</option>
                      <option value="required">Required</option>
                      <option value="off">None</option>
                    </select>
                  </Field>
                  {form.commentMode !== "off" && (
                    <Field label="Its prompt" htmlFor="pr-comment-label" optional>
                      <input id="pr-comment-label" value={form.commentLabel ?? ""} maxLength={80} onChange={(e) => set({ commentLabel: e.target.value })} className={fieldInputClass} placeholder="What could be better?" />
                    </Field>
                  )}
                </div>
              )}
              <Field label="Thank-you message" htmlFor="pr-thanks" optional>
                <input id="pr-thanks" value={form.thanksMessage ?? ""} maxLength={140} onChange={(e) => set({ thanksMessage: e.target.value })} className={fieldInputClass} placeholder="Thank you! Your answer helps us make myHoodora better." />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Layout</legend>
                  <div className="grid gap-2">
                    {LAYOUTS.map((l) => (
                      <button key={l.id} type="button" aria-pressed={form.layout === l.id} onClick={() => set({ layout: l.id })} className={cn("rounded-xl border px-3 py-2 text-left text-sm", form.layout === l.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}>
                        <span className="font-semibold">{l.label}</span> <span className="text-xs text-muted-foreground">{l.hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Colour</legend>
                  <div className="flex gap-2">
                    {PROMPT_ACCENTS.map((a) => (
                      <button key={a} type="button" aria-label={a} aria-pressed={form.accent === a} onClick={() => set({ accent: a })} className={cn("size-9 rounded-full ring-offset-2", form.accent === a && "ring-2 ring-primary")} style={{ background: ACCENT_SWATCH[a] }} />
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          </Panel>

          <Panel title="When it shows">
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {TRIGGERS.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    aria-pressed={form.triggerType === tr.id}
                    disabled={!!prompt?.sentAt}
                    onClick={() => set({ triggerType: tr.id, triggerKey: tr.id === "action" ? "listing_sold" : tr.id === "feature" ? "search" : undefined, triggerCount: tr.id === "feature" ? 3 : 1 })}
                    className={cn("rounded-xl border p-3 text-left text-sm disabled:opacity-60", form.triggerType === tr.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}
                  >
                    <span className="block font-semibold">{tr.label}</span>
                    <span className="block text-xs text-muted-foreground">{tr.hint}</span>
                  </button>
                ))}
              </div>
              {(form.triggerType === "action" || form.triggerType === "feature") && (
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                  <Field label={form.triggerType === "action" ? "After they" : "After using"} htmlFor="pr-key">
                    <select id="pr-key" value={form.triggerKey} onChange={(e) => set({ triggerKey: e.target.value as SignalKey })} className={fieldInputClass}>
                      {Object.entries(form.triggerType === "action" ? PROMPT_ACTIONS : PROMPT_FEATURES).map(([k, label]) => (
                        <option key={k} value={k}>
                          {form.triggerType === "action" ? label.toLowerCase() : label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={form.triggerType === "action" ? "From the Nth time" : "Times"} htmlFor="pr-count">
                    <input id="pr-count" type="number" min={1} max={100} value={form.triggerCount ?? 1} onChange={(e) => set({ triggerCount: Number(e.target.value) })} className={cn(fieldInputClass, "w-24")} />
                  </Field>
                  <Field label="Wait (seconds)" htmlFor="pr-delay" hint="So it never interrupts">
                    <input id="pr-delay" type="number" min={0} max={30} value={form.delaySeconds ?? 2} onChange={(e) => set({ delaySeconds: Number(e.target.value) })} className={cn(fieldInputClass, "w-24")} />
                  </Field>
                </div>
              )}
              {manual && (
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input type="checkbox" className="size-4" checked={!!form.push} disabled={!!prompt?.sentAt} onChange={(e) => set({ push: e.target.checked })} />
                  Also send a notification (it opens the question)
                  {prompt?.sentAt && <span className="font-normal text-muted-foreground">· sent {timeAgo(prompt.sentAt)}</span>}
                </label>
              )}

              <div role="radiogroup" aria-label="Who" className="flex flex-wrap gap-2">
                {(
                  [
                    ["everyone", "Everyone"],
                    ["hoods", "Chosen neighbourhoods"],
                    ["cities", "Cities"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={aim === id} onClick={() => setAim(id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", aim === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                    {label}
                  </button>
                ))}
              </div>
              {aim === "hoods" &&
                (!hoods.data ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading neighbourhoods…
                  </p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border p-3">
                    {hoods.data.items.map((h) => {
                      const on = form.hoodIds?.includes(h.id);
                      return (
                        <button key={h.id} type="button" aria-pressed={on} onClick={() => set({ hoodIds: on ? form.hoodIds!.filter((x) => x !== h.id) : [...(form.hoodIds ?? []), h.id] })} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                          {on && <Check className="size-3" aria-hidden />} {h.name}
                        </button>
                      );
                    })}
                  </div>
                ))}
              {aim === "cities" && (
                <Field label="Cities" htmlFor="pr-cities" hint="Separate with commas (e.g. Lagos, Abuja).">
                  <input id="pr-cities" defaultValue={form.cities?.join(", ")} onChange={(e) => set({ cities: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })} className={fieldInputClass} />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Joined at least (days ago)" htmlFor="pr-min" optional>
                  <input id="pr-min" type="number" min={0} value={form.minDaysSinceJoin ?? ""} onChange={(e) => set({ minDaysSinceJoin: e.target.value === "" ? null : Number(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Joined at most (days ago)" htmlFor="pr-max" optional>
                  <input id="pr-max" type="number" min={0} value={form.maxDaysSinceJoin ?? ""} onChange={(e) => set({ maxDaysSinceJoin: e.target.value === "" ? null : Number(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Starts" htmlFor="pr-start" optional>
                  <input id="pr-start" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Ends" htmlFor="pr-end" optional>
                  <input id="pr-end" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Priority" htmlFor="pr-priority" hint="1–10: higher shows first">
                  <input id="pr-priority" type="number" min={1} max={10} value={form.priority ?? 5} onChange={(e) => set({ priority: Number(e.target.value) })} className={fieldInputClass} />
                </Field>
                <Field label="Ask again if closed" htmlFor="pr-shows" hint="Most times one person sees it">
                  <input id="pr-shows" type="number" min={1} max={5} value={form.maxShows ?? 2} onChange={(e) => set({ maxShows: Number(e.target.value) })} className={fieldInputClass} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Name (staff only)">
            <input aria-label="Name" value={form.title ?? ""} maxLength={80} onChange={(e) => set({ title: e.target.value })} className={fieldInputClass} placeholder="e.g. For Sale: after a sale" />
          </Panel>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => void save(false)} disabled={saving || !ready}>
              {prompt ? "Save changes" : "Save draft"}
            </Button>
            {status !== "active" && !manual && (
              <Button onClick={() => void save(true)} disabled={saving || !ready}>
                Save and go live
              </Button>
            )}
          </div>

          {prompt && <ResultsPanel prompt={prompt} />}
        </div>

        <div className="space-y-2 lg:sticky lg:top-6">
          <p className="text-sm font-semibold text-muted-foreground">On a phone · try it</p>
          <PromptPreview prompt={clean(form)} />
        </div>
      </div>

      {confirm === "send" && prompt && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Send this question now?"
          consequence={`It appears the next time each neighbour ${prompt.hoodIds.length || prompt.cities.length ? "in its audience" : "anywhere"} opens the app${prompt.push ? ", and they get a notification now" : ""}. It can't be unsent (you can end it).`}
          requireReason={false}
          confirmLabel="Send now"
          onConfirm={async () => {
            if (!user) return;
            onSaved(await sendPrompt(user, prompt._id));
            toast.success("Sent.");
          }}
        />
      )}
      {confirm === "delete" && prompt && (
        <ActionDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`Delete “${prompt.title}”?`}
          consequence="It stops showing at once. Its answers stay in the results."
          requireReason={false}
          destructive
          confirmLabel="Delete"
          onConfirm={async () => {
            if (!user) return;
            await deletePrompt(user, prompt._id);
            toast.success("Deleted.");
            router.replace("/admin/feedback");
          }}
        />
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: NonNullable<AdminPromptInput["options"]>; onChange: (o: NonNullable<AdminPromptInput["options"]>) => void }) {
  const add = () => onChange([...options, { id: `o${Date.now().toString(36)}`, label: "" }]);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Choices (2–6)</legend>
      {options.map((o, i) => (
        <div key={o.id} className="flex gap-2">
          <input aria-label={`Choice ${i + 1} emoji`} value={o.emoji ?? ""} maxLength={8} placeholder="🙂" onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, emoji: e.target.value || undefined } : x)))} className={cn(fieldInputClass, "w-16 text-center")} />
          <input aria-label={`Choice ${i + 1}`} value={o.label} maxLength={60} placeholder={`Choice ${i + 1}`} onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={fieldInputClass} />
          <Button variant="outline" size="sm" aria-label={`Remove choice ${i + 1}`} onClick={() => onChange(options.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {options.length < 6 && (
        <Button variant="outline" size="sm" onClick={add}>
          Add a choice
        </Button>
      )}
    </fieldset>
  );
}

/** Who saw it, who answered, the spread of answers, and what people wrote. */
function ResultsPanel({ prompt }: { prompt: AdminPrompt }) {
  const { user } = useAuth();
  const [r, setR] = useState<PromptResults | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getPromptResults(user, prompt._id)
      .then((x) => alive && (setR(x), setError(null)))
      .catch((e: unknown) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [user, prompt._id, nonce]);
  const label = (k: string) => (prompt.kind === "poll" ? (prompt.options.find((o) => o.id === k)?.label ?? k) : prompt.kind === "thumbs" ? (k === "1" ? "👍 Yes" : "👎 Not really") : prompt.kind === "stars" ? `${"★".repeat(Number(k))}` : k);
  const keys = prompt.kind === "stars" ? ["5", "4", "3", "2", "1"] : prompt.kind === "nps" ? Array.from({ length: 11 }, (_, i) => String(10 - i)) : prompt.kind === "thumbs" ? ["1", "0"] : prompt.options.map((o) => o.id);
  const most = Math.max(1, ...Object.values(r?.distribution ?? {}));
  return (
    <Panel
      title="Answers"
      action={
        r && r.responses > 0 ? (
          <Button size="sm" variant="outline" onClick={() => user && void downloadPromptCsv(user, prompt._id, `${prompt.title.replace(/[^\w-]+/g, "-")}.csv`).catch((e: unknown) => toast.error(errorMessage(e)))}>
            <Download className="size-3.5" /> CSV
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <AdminProblem error={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !r ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Saw it", r.shown.toLocaleString()],
                ["Answered", r.responses.toLocaleString()],
                ["Answer rate", `${r.responseRate}%`],
                prompt.kind === "nps" ? ["NPS", r.nps ? String(r.nps.score) : "–"] : prompt.kind === "thumbs" ? ["Said yes", r.average === null ? "–" : `${Math.round(r.average * 100)}%`] : prompt.kind === "stars" ? ["Average", r.average === null ? "–" : `${r.average} ★`] : ["Closed it", r.dismissed.toLocaleString()],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {r.nps && (
            <p className="text-sm text-muted-foreground">
              {r.nps.promoters} would recommend (9–10), {r.nps.passives} passive (7–8), {r.nps.detractors} unlikely (0–6). NPS = % recommending − % unlikely.
            </p>
          )}
          {prompt.kind !== "open" && r.responses > 0 && (
            <ul className="space-y-1.5">
              {keys.map((k) => (
                <li key={k} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate">{label(k)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${((r.distribution[k] ?? 0) / most) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{r.distribution[k] ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold">What people wrote</p>
            {r.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {r.comments.map((c, i) => (
                  <li key={i} className="space-y-1 p-3 text-sm">
                    <p>{c.comment}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.value !== null || c.optionId ? `${label(c.optionId ?? String(c.value))} · ` : ""}
                      {c.name}
                      {c.hood ? ` · ${c.hood}` : ""} · {timeAgo(c.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
