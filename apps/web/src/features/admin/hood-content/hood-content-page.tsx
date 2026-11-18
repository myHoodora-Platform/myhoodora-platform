"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CONTENT_TAG_LABELS,
  CONTENT_TAGS,
  TEAM_CATEGORIES,
  type ContentItem,
  type ContentTag,
  type ScheduleResult,
  type ScheduledStatus,
  type ScheduleSource,
  type TeamCategory,
} from "@myhoodora/api-contract/hood-content";
import { CalendarClock, FileUp, Sparkles } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminProblem, EmptyBody } from "@/components/admin/admin-states";
import { Panel } from "@/components/admin/detail";
import { StatusBadge } from "@/components/admin/status-badge";
import { Field, fieldInputClass } from "@/components/shared/field";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import {
  applyActivationPlan,
  cancelScheduledTeamPost,
  cancelTeamBatch,
  composeTeamPost,
  getDailyOverview,
  importContentBank,
  listAllOpenHoods,
  listContentItems,
  listScheduledTeamPosts,
  setDailyPromptFor,
  updateContentItem,
  updateDailySettings,
} from "@/lib/api/admin/hood-content";
import type { AdminHood } from "@/lib/api/admin/types";
import { useAdminSession } from "../session";
import { useAdminQuery } from "../use-admin-query";
import { EMPTY_CHOICE, HoodPicker, hoodsFor, toTarget, type HoodChoice } from "./hood-picker";

type Tab = "activation" | "compose" | "bank" | "daily" | "scheduled";
const TABS: { id: Tab; label: string }[] = [
  { id: "activation", label: "Activation" },
  { id: "compose", label: "Post as Hood Team" },
  { id: "bank", label: "Content bank" },
  { id: "daily", label: "Daily prompt" },
  { id: "scheduled", label: "Scheduled" },
];

const CATEGORY_LABEL: Record<TeamCategory, string> = { general: "General", recommendation: "Recommendation", for_sale: "Declutter prompt", event: "Event", lost_found: "Lost & found", poll: "Poll" };

/** Fills {hood}/{city} the way the API does, for previews. */
const fill = (text: string, hood?: AdminHood) => text.replace(/\{hood\}/g, hood?.name ?? "Lekki Phase 1").replace(/\{city\}/g, hood?.city ?? "Lagos");

/**
 * `/admin/hood-content`: the official Hood Team (docs/product/hood-activation-plan.md). Every staff
 * member can look; admins and the owner (content.manage) post, schedule and edit.
 */
export function HoodContentPage() {
  const { can } = useAdminSession();
  const [tab, setTab] = useState<Tab>("activation");
  const hoods = useAdminQuery(listAllOpenHoods, "hood-content:hoods");
  const bank = useAdminQuery((u) => listContentItems(u), "hood-content:items");
  const editable = can("content.manage");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Hood content" }]}
        title="Hood content"
        description="The official Hood Team account. Welcome posts, conversation starters, local information and daily prompts, so nobody arrives to an empty Hood. Everything is labelled “Official · Hood Team”, never shown as a neighbour."
      />
      {!editable && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">You can look around. Admins post and change the Hood Team&apos;s content.</p>}

      <div role="tablist" aria-label="Hood content" className="flex w-fit flex-wrap gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {bank.error ? (
        <AdminProblem error={bank.error} onRetry={() => void bank.refetch()} />
      ) : tab === "activation" ? (
        <ActivationTab hoods={hoods.data} editable={editable} bankEmpty={bank.data?.length === 0} onGoToBank={() => setTab("bank")} />
      ) : tab === "compose" ? (
        <ComposeTab hoods={hoods.data} items={bank.data} editable={editable} />
      ) : tab === "bank" ? (
        <BankTab items={bank.data} editable={editable} onChanged={() => void bank.refetch()} />
      ) : tab === "daily" ? (
        <DailyTab items={bank.data} editable={editable} />
      ) : (
        <ScheduledTab editable={editable} />
      )}
    </div>
  );
}

// ── Activation ────────────────────────────────────────────────────────────

function ActivationTab({ hoods, editable, bankEmpty, onGoToBank }: { hoods: AdminHood[] | null; editable: boolean; bankEmpty: boolean; onGoToBank: () => void }) {
  const { user } = useAuth();
  const [choice, setChoice] = useState<HoodChoice>(EMPTY_CHOICE);
  const [startDate, setStartDate] = useState("");
  const [threshold, setThreshold] = useState(15);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const target = toTarget(choice);

  const apply = async () => {
    if (!user || !target) return;
    setBusy(true);
    try {
      setResult(await applyActivationPlan(user, { ...target, startDate: startDate || undefined, skipIfPostsAtLeast: threshold }));
      toast.success("Activation plan scheduled.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't schedule the plan."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel title="Activate quiet Hoods">
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Schedules a new Hood&apos;s first ten days: a pinned welcome post, then conversation starters, polls and local information, morning and evening, so the Hood looks naturally active. Hoods that are already busy are left alone, and applying it again never posts anything twice.
          </p>
          {bankEmpty && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The content bank is empty. <button type="button" className="font-semibold underline" onClick={onGoToBank}>Import it first</button>.
            </p>
          )}
          <HoodPicker hoods={hoods} value={choice} onChange={setChoice} idPrefix="act" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day 0 (Lagos date)" htmlFor="act-start" hint="Empty: today. Steps whose time has passed go out straight away.">
              <input id="act-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Leave Hoods alone with at least … posts" htmlFor="act-threshold" hint="15 is when a Hood stops feeling empty.">
              <input id="act-threshold" type="number" min={0} max={1000} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={fieldInputClass} />
            </Field>
          </div>
          <Button onClick={() => void apply()} disabled={!editable || !target || busy} loading={busy}>
            <Sparkles className="size-4" aria-hidden /> Schedule the activation plan
          </Button>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="The ten days">
          <ol className="space-y-1.5 text-sm">
            {[
              ["Day 0", "📌 Welcome post (pinned 7 days) · emergency numbers"],
              ["Day 1", "Introduce yourself · poll: biggest street issue"],
              ["Day 2", "Who supplies our light · best electrician"],
              ["Day 3", "Safety habit · jollof poll"],
              ["Day 4", "Waste collection · lost & found"],
              ["Day 5", "Best plumber · weekend events"],
              ["Day 6", "Declutter Saturday · thank a neighbour"],
              ["Day 7", "Who can see your posts · one thing to fix"],
              ["Day 8–9", "Invite neighbours · one thing to add"],
            ].map(([d, t]) => (
              <li key={d} className="flex gap-3">
                <span className="w-14 shrink-0 font-semibold">{d}</span>
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ol>
        </Panel>
        {result && <ResultPanel result={result} />}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: ScheduleResult }) {
  return (
    <Panel title="Scheduled">
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-semibold">{result.scheduled}</span> post{result.scheduled === 1 ? "" : "s"} in <span className="font-semibold">{result.hoods}</span> Hood{result.hoods === 1 ? "" : "s"}.
          {result.activeHoods ? ` ${result.activeHoods} busy Hood${result.activeHoods === 1 ? " was" : "s were"} left alone.` : ""}
          {result.alreadyScheduled ? ` ${result.alreadyScheduled} already scheduled earlier.` : ""}
        </p>
        {result.needsLocalDetails.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
            <p className="font-semibold">Skipped until local details are added</p>
            <p className="mb-1.5">Add a city version to these items in the Content bank, then apply again: only the missing posts are added.</p>
            <ul className="list-disc pl-5">
              {result.needsLocalDetails.map((w) => (
                <li key={w.code}>
                  {w.code}: {w.cities.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Compose ───────────────────────────────────────────────────────────────

function ComposeTab({ hoods, items, editable }: { hoods: AdminHood[] | null; items: ContentItem[] | null; editable: boolean }) {
  const { user } = useAuth();
  const [itemId, setItemId] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<TeamCategory>("general");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pinDays, setPinDays] = useState(0);
  const [when, setWhen] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [choice, setChoice] = useState<HoodChoice>(EMPTY_CHOICE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);

  const item = items?.find((i) => i._id === itemId);
  const chosen = hoodsFor(choice, hoods ?? []);
  const text = message || item?.body || "";
  const target = toTarget(choice);
  const pollReady = category !== "poll" || pollOptions.filter((o) => o.trim()).length >= 2;

  const startFrom = (id: string) => {
    setItemId(id);
    const i = items?.find((x) => x._id === id);
    if (!i) return;
    setMessage("");
    setCategory(i.category);
    setPollOptions(i.pollOptions ?? ["", ""]);
    setPinDays(i.pinDays ?? 0);
  };

  const submit = async () => {
    if (!user || !target) return;
    setBusy(true);
    try {
      const res = await composeTeamPost(user, {
        ...target,
        itemId: itemId || undefined,
        message: message.trim() || undefined,
        category,
        ...(category === "poll" && { pollOptions: pollOptions.map((o) => o.trim()).filter(Boolean) }),
        ...(category === "event" && { eventDate: eventDate ? new Date(eventDate).toISOString() : undefined, eventLocation }),
        pinDays: pinDays || undefined,
        runAt: when ? new Date(when).toISOString() : undefined,
      });
      setResult(res);
      toast.success(when ? "Scheduled." : "Posting now.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't post."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel title="Post as the Hood Team">
        <div className="space-y-5">
          <Field label="Start from the content bank" htmlFor="cmp-item" optional>
            <select id="cmp-item" value={itemId} onChange={(e) => startFrom(e.target.value)} className={fieldInputClass}>
              <option value="">Write my own</option>
              {CONTENT_TAGS.map((tag) => (
                <optgroup key={tag} label={CONTENT_TAG_LABELS[tag]}>
                  {(items ?? [])
                    .filter((i) => i.tag === tag && i.active)
                    .map((i) => (
                      <option key={i._id} value={i._id}>
                        {i.code} · {i.body.slice(0, 70)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Text" htmlFor="cmp-text" hint="{hood} and {city} are filled in for each Hood. Leave empty to use the item's text (and its city versions).">
            <textarea id="cmp-text" rows={6} value={message} placeholder={item?.body ?? "Good morning, {hood}! …"} onChange={(e) => setMessage(e.target.value)} className={fieldInputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="cmp-cat">
              <select id="cmp-cat" value={category} onChange={(e) => setCategory(e.target.value as TeamCategory)} className={fieldInputClass}>
                {TEAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pin on top for (days)" htmlFor="cmp-pin" hint="0 = not pinned. At most 2 pinned per Hood.">
              <input id="cmp-pin" type="number" min={0} max={30} value={pinDays} onChange={(e) => setPinDays(Number(e.target.value))} className={fieldInputClass} />
            </Field>
            <Field label="When" htmlFor="cmp-when" hint="Empty = now. Your computer's time.">
              <input id="cmp-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={fieldInputClass} />
            </Field>
          </div>
          {category === "poll" && (
            <Field label="Poll options (2–4)" htmlFor="cmp-poll-0">
              <div className="space-y-2">
                {pollOptions.map((o, i) => (
                  <input key={i} id={`cmp-poll-${i}`} value={o} maxLength={60} onChange={(e) => setPollOptions(pollOptions.map((x, j) => (j === i ? e.target.value : x)))} className={fieldInputClass} />
                ))}
                {pollOptions.length < 4 && (
                  <Button size="sm" variant="outline" onClick={() => setPollOptions([...pollOptions, ""])}>
                    Add option
                  </Button>
                )}
              </div>
            </Field>
          )}
          {category === "event" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Event date and time" htmlFor="cmp-ev-date">
                <input id="cmp-ev-date" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={fieldInputClass} />
              </Field>
              <Field label="Place" htmlFor="cmp-ev-place" hint="{hood} works here too.">
                <input id="cmp-ev-place" value={eventLocation} maxLength={200} onChange={(e) => setEventLocation(e.target.value)} className={fieldInputClass} />
              </Field>
            </div>
          )}
          <HoodPicker hoods={hoods} value={choice} onChange={setChoice} idPrefix="cmp" />
          <Button onClick={() => void submit()} disabled={!editable || !target || !text.trim() || !pollReady || busy} loading={busy}>
            {when ? <CalendarClock className="size-4" aria-hidden /> : null}
            {when ? "Schedule" : "Post now"} in {chosen.length} Hood{chosen.length === 1 ? "" : "s"}
          </Button>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Preview">
          {text ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-bold">
                myHoodora Hood Team <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Official · Hood Team</span>
              </p>
              {pinDays > 0 && <p className="text-xs font-semibold text-primary">📌 Pinned for {pinDays} day{pinDays === 1 ? "" : "s"}</p>}
              <p className="whitespace-pre-wrap">{fill(text, chosen[0])}</p>
              {category === "poll" && (
                <ul className="space-y-1">
                  {pollOptions.filter((o) => o.trim()).map((o) => (
                    <li key={o} className="rounded-lg border border-border px-3 py-1.5">
                      {o}
                    </li>
                  ))}
                </ul>
              )}
              {/\[FILL/i.test(text) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">This still has [FILL: …]. It only posts in cities that have their own version.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pick an item or write something.</p>
          )}
        </Panel>
        {result && <ResultPanel result={result} />}
      </div>
    </div>
  );
}

// ── Content bank ──────────────────────────────────────────────────────────

function BankTab({ items, editable, onChanged }: { items: ContentItem[] | null; editable: boolean; onChanged: () => void }) {
  const { user } = useAuth();
  const [tag, setTag] = useState<ContentTag | "all">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => (tag === "all" || i.tag === tag) && (!needle || `${i.code} ${i.body}`.toLowerCase().includes(needle)));
  }, [items, tag, q]);

  const importFile = async (file: File | undefined) => {
    if (!user || !file) return;
    setImporting(true);
    try {
      const res = await importContentBank(user, await file.text(), overwrite);
      toast.success(`${res.added} added, ${res.updated} updated, ${res.unchanged} unchanged.`);
      if (res.problems.length) toast.warning(`${res.problems.length} item${res.problems.length === 1 ? "" : "s"} couldn't be read: ${res.problems.slice(0, 3).map((p) => `${p.heading}: ${p.problem}`).join("; ")}`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't import."));
    } finally {
      setImporting(false);
    }
  };

  const toggleActive = async (item: ContentItem) => {
    if (!user) return;
    try {
      await updateContentItem(user, item._id, { active: !item.active });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    }
  };

  return (
    <div className="space-y-6">
      {editable && (
        <Panel title="Import">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground", importing && "opacity-50")}>
              <FileUp className="size-4" aria-hidden /> {importing ? "Importing…" : "Import hood-content-bank.md"}
              <input type="file" accept=".md,text/markdown,text/plain" className="sr-only" disabled={importing} onChange={(e) => void importFile(e.target.files?.[0])} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Replace the text of items already here (city versions are kept)
            </label>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">The file is docs/product/hood-content-bank.md. New codes are added; with the box ticked, changed text replaces what&apos;s here.</p>
        </Panel>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Kind" value={tag} onChange={(e) => setTag(e.target.value as ContentTag | "all")} className={cn(fieldInputClass, "w-auto")}>
          <option value="all">Everything ({items?.length ?? 0})</option>
          {CONTENT_TAGS.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TAG_LABELS[t]} ({items?.filter((i) => i.tag === t).length ?? 0})
            </option>
          ))}
        </select>
        <input aria-label="Search the bank" placeholder="Search code or text" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldInputClass, "max-w-xs")} />
      </div>
      <Panel padded={false}>
        {!items ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <EmptyBody icon={Sparkles} title={items.length ? "Nothing matches" : "The content bank is empty"} description={items.length ? "Try another search." : "Import docs/product/hood-content-bank.md above."} />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((i) => (
              <li key={i._id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
                <span className="w-12 shrink-0 font-mono text-sm font-semibold">{i.code}</span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="line-clamp-3 block text-sm whitespace-pre-wrap">{i.body}</span>
                  <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{CONTENT_TAG_LABELS[i.tag]}</span>·<span>{CATEGORY_LABEL[i.category]}</span>
                    {i.pinDays ? <span>· pinned {i.pinDays}d</span> : null}
                    {i.cityVariants.length ? <span>· versions for {i.cityVariants.map((v) => v.city).join(", ")}</span> : null}
                    <span>· used {i.timesUsed}×</span>
                  </span>
                </span>
                {i.needsLocalDetails && <StatusBadge status="pending_review" label="Needs local details" />}
                {!i.active && <StatusBadge status="resolved" label="Off" />}
                {editable && (
                  <span className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(i)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(i)}>
                      {i.active ? "Switch off" : "Switch on"}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {editing && (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

const CITIES = ["Lagos", "Ibadan"];

function ItemEditor({ item, onClose, onSaved }: { item: ContentItem; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [body, setBody] = useState(item.body);
  const [pinDays, setPinDays] = useState(item.pinDays ?? 0);
  const [variants, setVariants] = useState<Record<string, string>>(() => Object.fromEntries([...new Set([...CITIES, ...item.cityVariants.map((v) => v.city)])].map((c) => [c, item.cityVariants.find((v) => v.city === c)?.body ?? ""])));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateContentItem(user, item._id, {
        body,
        pinDays: pinDays || null,
        cityVariants: Object.entries(variants)
          .filter(([, b]) => b.trim())
          .map(([city, b]) => ({ city, body: b.trim() })),
      });
      toast.success("Saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Edit ${item.code}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Edit {item.code}</h2>
        <Field label="Text" htmlFor="ed-body" hint="{hood} and {city} are filled in. [FILL: …] marks local details: the item only posts where a city version exists.">
          <textarea id="ed-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="Pin on top for (days)" htmlFor="ed-pin" hint="0 = not pinned.">
          <input id="ed-pin" type="number" min={0} max={30} value={pinDays} onChange={(e) => setPinDays(Number(e.target.value))} className={cn(fieldInputClass, "w-32")} />
        </Field>
        {Object.keys(variants).map((city) => (
          <Field key={city} label={`Version for ${city}`} htmlFor={`ed-${city}`} optional hint="Real, checked local details. Used instead of the text above in this city's Hoods.">
            <textarea id={`ed-${city}`} rows={5} value={variants[city]} onChange={(e) => setVariants({ ...variants, [city]: e.target.value })} className={fieldInputClass} />
          </Field>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={saving || !body.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Daily prompt ──────────────────────────────────────────────────────────

function DailyTab({ items, editable }: { items: ContentItem[] | null; editable: boolean }) {
  const { user } = useAuth();
  const daily = useAdminQuery(getDailyOverview, "hood-content:daily");
  const [busy, setBusy] = useState(false);
  const choices = (items ?? []).filter((i) => i.active && (i.tag === "daily" || i.tag === "festive" || i.tag === "starter"));

  const run = async (fn: () => Promise<Awaited<ReturnType<typeof getDailyOverview>>>) => {
    setBusy(true);
    try {
      daily.setData(await fn());
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  };

  if (daily.error) return <AdminProblem error={daily.error} onRetry={() => void daily.refetch()} />;
  const d = daily.data;
  if (!d || !user) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Panel title="Daily prompt">
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">One question a day in every open Hood (Hoods in their first ten days are skipped that day). Mondays power, Tuesdays trusted people, Wednesdays a poll, Thursdays safety, Fridays the weekend, Saturdays declutter, Sundays gratitude.</p>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="size-4" disabled={!editable || busy} checked={d.daily.enabled} onChange={(e) => void run(() => updateDailySettings(user, { enabled: e.target.checked }))} />
            Post a daily prompt
          </label>
          <Field label="Time (Lagos)" htmlFor="daily-hour">
            <select id="daily-hour" disabled={!editable || busy} value={d.daily.hour} onChange={(e) => void run(() => updateDailySettings(user, { hour: Number(e.target.value) }))} className={fieldInputClass}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Only Hoods with at least … neighbours" htmlFor="daily-min" hint="0 = every open Hood, so new arrivals always find something.">
            <input id="daily-min" type="number" min={0} max={1000} disabled={!editable || busy} defaultValue={d.daily.minNeighbours} onBlur={(e) => Number(e.target.value) !== d.daily.minNeighbours && void run(() => updateDailySettings(user, { minNeighbours: Number(e.target.value) }))} className={fieldInputClass} />
          </Field>
          {d.dailyDoneFor && <p className="text-muted-foreground">Last went out for {d.dailyDoneFor}.</p>}
        </div>
      </Panel>
      <Panel title="Next 14 days" padded={false}>
        <ul className="divide-y divide-border">
          {d.upcoming.map((u) => (
            <li key={u.date} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="w-28 shrink-0 font-semibold">{new Date(`${u.date}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="min-w-0 flex-1 truncate">{u.text ?? <span className="text-muted-foreground">Nothing</span>}</span>
              <select
                aria-label={`Prompt for ${u.date}`}
                disabled={!editable || busy}
                value={u.chosen ? (u.code ?? "") : ""}
                onChange={(e) => void run(() => setDailyPromptFor(user, u.date, e.target.value || null))}
                className={cn(fieldInputClass, "w-48 py-1.5")}
              >
                <option value="">Rotation ({u.chosen ? "…" : (u.code ?? "none")})</option>
                {choices.map((i) => (
                  <option key={i._id} value={i.code}>
                    {i.code} · {i.body.slice(0, 40)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ── Scheduled ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ScheduledStatus, { status: string; label: string }> = {
  scheduled: { status: "under_review", label: "Scheduled" },
  published: { status: "active", label: "Posted" },
  cancelled: { status: "resolved", label: "Cancelled" },
  skipped: { status: "member", label: "Skipped" },
  failed: { status: "high", label: "Failed" },
};
const SOURCE_LABEL: Record<ScheduleSource, string> = { compose: "Posted by staff", activation: "Activation plan", daily: "Daily prompt" };

function ScheduledTab({ editable }: { editable: boolean }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ScheduledStatus | "all">("scheduled");
  const [source, setSource] = useState<ScheduleSource | "all">("all");
  const rows = useAdminQuery((u) => listScheduledTeamPosts(u, { status, source, limit: 200 }), `hood-content:scheduled:${status}:${source}`);

  const cancel = async (id: string) => {
    if (!user) return;
    try {
      await cancelScheduledTeamPost(user, id);
      void rows.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't cancel."));
    }
  };
  const cancelBatch = async (batchId: string) => {
    if (!user) return;
    try {
      const { cancelled } = await cancelTeamBatch(user, batchId);
      toast.success(`${cancelled} cancelled.`);
      void rows.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't cancel."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ScheduledStatus | "all")} className={cn(fieldInputClass, "w-auto")}>
          <option value="all">Any status</option>
          {(Object.keys(STATUS_BADGE) as ScheduledStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_BADGE[s].label}
            </option>
          ))}
        </select>
        <select aria-label="From" value={source} onChange={(e) => setSource(e.target.value as ScheduleSource | "all")} className={cn(fieldInputClass, "w-auto")}>
          <option value="all">Everything</option>
          {(Object.keys(SOURCE_LABEL) as ScheduleSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <Panel padded={false}>
        {rows.error ? (
          <AdminProblem error={rows.error} onRetry={() => void rows.refetch()} />
        ) : !rows.data ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : rows.data.length === 0 ? (
          <EmptyBody icon={CalendarClock} title="Nothing here" description="Try another status." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.data.map((r) => (
              <li key={r._id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-36 shrink-0 tabular-nums text-muted-foreground">{new Date(r.runAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {r.hoodName} <span className="font-normal text-muted-foreground">· {SOURCE_LABEL[r.source]}{r.code ? ` · ${r.code}` : ""}</span>
                  </span>
                  <span className="line-clamp-2 block text-muted-foreground">{r.message}</span>
                  {r.problem && <span className="block text-destructive">{r.problem}</span>}
                </span>
                <StatusBadge status={STATUS_BADGE[r.status].status} label={STATUS_BADGE[r.status].label} />
                {editable && r.status === "scheduled" && (
                  <span className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => void cancel(r._id)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void cancelBatch(r.batchId)}>
                      Cancel batch
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
