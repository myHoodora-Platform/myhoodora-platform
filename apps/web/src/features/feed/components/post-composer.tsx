"use client";

import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, HeartHandshake, Plus, WifiOff, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { EmojiPickerButton, insertAtCaret } from "@/components/shared/emoji-picker-button";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { ImagePicker } from "@/components/shared/image-picker";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { errorMessage } from "@/lib/api/client";
import type { AlertCategory, Post, PostCategory } from "@/lib/api/types";
import { ALERT_CATEGORIES, POST_CATEGORIES, categoryDef } from "../categories";
import { needsKindnessReminder } from "../kindness";
import { useFeed } from "../feed-context";

const MAX_POLL_OPTIONS = 4;
const POLL_DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
] as const;

const schema = z
  .object({
    category: z.enum(["general", "recommendation", "alert", "event", "for_sale", "lost_found", "thanks", "poll"]),
    message: z.string().trim().min(1, "Write something to share.").max(3000, "Keep it under 3,000 characters."),
    alertCategory: z.string().optional(),
    urgent: z.boolean().optional(),
    eventDate: z.string().optional(),
    eventLocation: z.string().trim().optional(),
    thankedName: z.string().trim().optional(),
    pollOptions: z.array(z.object({ text: z.string().trim().max(60, "Keep options under 60 characters.") })),
    pollDays: z.number(),
  })
  .superRefine((v, ctx) => {
    if (v.category === "alert" && !v.alertCategory) {
      ctx.addIssue({ code: "custom", path: ["alertCategory"], message: "Choose what kind of alert this is." });
    }
    if (v.category === "event") {
      if (!v.eventDate) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Add a date and time." });
      else if (new Date(v.eventDate).getTime() < Date.now() - 60 * 60 * 1000) {
        ctx.addIssue({ code: "custom", path: ["eventDate"], message: "That date has already passed." });
      }
      if (!v.eventLocation) ctx.addIssue({ code: "custom", path: ["eventLocation"], message: "Add where it's happening." });
    }
    if (v.category === "thanks" && !v.thankedName) {
      ctx.addIssue({ code: "custom", path: ["thankedName"], message: "Who are you thanking?" });
    }
    if (v.category === "poll") {
      const filled = v.pollOptions.map((o) => o.text.trim()).filter(Boolean);
      if (filled.length < 2) {
        ctx.addIssue({ code: "custom", path: ["pollOptions"], message: "Add at least 2 options." });
      } else if (new Set(filled.map((t) => t.toLowerCase())).size !== filled.length) {
        ctx.addIssue({ code: "custom", path: ["pollOptions"], message: "Each option must be different." });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

const PLACEHOLDERS: Record<PostCategory, string> = {
  general: "What's happening, neighbour?",
  recommendation: "What are you looking for? e.g. a reliable plumber in Lekki Phase 1",
  alert: "What's happening, where, and when? Stick to facts.",
  event: "Tell neighbours what's happening and who it's for",
  for_sale: "",
  lost_found: "What was lost or found, and where?",
  thanks: "What did they do that made a difference?",
  poll: "Ask a question, e.g. Should we hire a second night guard for Road 12?",
};

interface PostComposerProps {
  initialCategory?: PostCategory;
  onDone: (post: Post) => void;
  onCancel: () => void;
  /** "Sell or give away" is a listing, not a post — hand off to that flow. */
  onSell: () => void;
}

export function PostComposer({ initialCategory, onDone, onCancel, onSell }: PostComposerProps) {
  const { createPost } = useFeed();
  const online = useOnlineStatus();
  const [step, setStep] = useState<"pick" | "write">(initialCategory ? "write" : "pick");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [kindnessShown, setKindnessShown] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const messageEl = useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: initialCategory ?? "general",
      message: "",
      urgent: false,
      pollOptions: [{ text: "" }, { text: "" }],
      pollDays: 3,
    },
  });
  const { register, handleSubmit, watch, setValue, getValues, control, formState } = form;
  const { errors, isSubmitting } = formState;
  const pollOptions = useFieldArray({ control, name: "pollOptions" });
  const category = watch("category");
  const alertCategory = watch("alertCategory");
  const pollDays = watch("pollDays");
  const def = categoryDef(category);

  const pick = (id: PostCategory) => {
    if (id === "for_sale") return onSell();
    setValue("category", id);
    setStep("write");
  };

  const submit = async (values: FormValues) => {
    setSubmitError(null);
    if (!kindnessShown && needsKindnessReminder(values.message)) {
      setKindnessShown(true);
      return;
    }
    try {
      const options = values.pollOptions
        .map((o) => o.text.trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `o${i + 1}`, text }));
      const post = await createPost({
        message: values.message,
        mediaUrl: mediaUrl ?? undefined,
        meta: {
          category: values.category,
          alertCategory: values.category === "alert" ? (values.alertCategory as AlertCategory) : undefined,
          urgent: values.category === "alert" ? values.urgent || undefined : undefined,
          eventDate: values.category === "event" ? values.eventDate : undefined,
          eventLocation: values.category === "event" ? values.eventLocation : undefined,
          thankedName: values.category === "thanks" ? values.thankedName : undefined,
          poll:
            values.category === "poll"
              ? { options, closesAt: new Date(Date.now() + values.pollDays * 86_400_000).toISOString() }
              : undefined,
        },
      });
      toast.success(
        values.category === "alert"
          ? "Alert sent to your neighbours."
          : values.category === "poll"
            ? "Poll posted."
            : "Posted to your neighbourhood.",
      );
      onDone(post);
    } catch (err) {
      // Stay open with the draft intact; say why it failed right here.
      setSubmitError(errorMessage(err, "Couldn't post. Your draft is still here, so try again."));
    }
  };

  if (step === "pick") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {POST_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <c.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold text-foreground">{c.label}</span>
              <span className="block text-xs text-muted-foreground">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const messageReg = register("message");
  const pollError =
    (errors.pollOptions as { message?: string } | undefined)?.message ??
    (errors.pollOptions as { root?: { message?: string } } | undefined)?.root?.message ??
    errors.pollOptions?.find?.((o) => o?.text)?.text?.message;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <button
        type="button"
        onClick={() => setStep("pick")}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        <def.icon className="size-3.5" aria-hidden />
        {def.label}
        <span className="sr-only">, change category</span>
      </button>

      {category === "alert" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">What kind of alert?</legend>
          <div className="flex flex-wrap gap-2">
            {ALERT_CATEGORIES.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={alertCategory === a.id}
                onClick={() => setValue("alertCategory", a.id, { shouldValidate: true })}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold transition-colors",
                  alertCategory === a.id ? cn(a.tone, "border-transparent") : "hover:bg-muted",
                )}
              >
                <a.icon className="size-4" aria-hidden />
                {a.label}
              </button>
            ))}
          </div>
          {errors.alertCategory && (
            <p className="text-xs font-semibold text-destructive">{errors.alertCategory.message}</p>
          )}
        </fieldset>
      )}

      {category === "thanks" && (
        <Field label="Who are you thanking?" htmlFor="thankedName" error={errors.thankedName?.message}>
          <input
            {...register("thankedName")}
            {...fieldAria("thankedName", errors.thankedName?.message)}
            placeholder="e.g. Mallam Sani, Road 3 security"
            className={fieldInputClass}
          />
        </Field>
      )}

      <Field label={category === "poll" ? "Your question" : "Your post"} htmlFor="message" error={errors.message?.message}>
        <textarea
          {...messageReg}
          {...fieldAria("message", errors.message?.message)}
          ref={(el) => {
            messageReg.ref(el);
            messageEl.current = el;
          }}
          rows={category === "poll" ? 2 : 5}
          autoFocus
          placeholder={PLACEHOLDERS[category]}
          className={cn(fieldInputClass, category === "poll" ? "min-h-20" : "min-h-32", "resize-y")}
          onChange={(e) => {
            void messageReg.onChange(e);
            setKindnessShown(false);
          }}
        />
      </Field>

      {category === "poll" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Options</legend>
          {pollOptions.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                {...register(`pollOptions.${i}.text`)}
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}${i >= 2 ? " (optional)" : ""}`}
                maxLength={60}
                className={fieldInputClass}
              />
              {pollOptions.fields.length > 2 && (
                <button
                  type="button"
                  onClick={() => pollOptions.remove(i)}
                  aria-label={`Remove option ${i + 1}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {pollOptions.fields.length < MAX_POLL_OPTIONS && (
            <Button variant="ghost" size="sm" onClick={() => pollOptions.append({ text: "" })}>
              <Plus className="size-4" /> Add option
            </Button>
          )}
          {pollError && <p className="text-xs font-semibold text-destructive">{pollError}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold">Poll closes in</span>
            {POLL_DURATIONS.map((d) => (
              <button
                key={d.days}
                type="button"
                aria-pressed={pollDays === d.days}
                onClick={() => setValue("pollDays", d.days)}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-semibold",
                  pollDays === d.days ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Votes are anonymous. Neighbours see results after they vote.</p>
        </fieldset>
      )}

      {category === "event" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date & time" htmlFor="eventDate" error={errors.eventDate?.message}>
            <input
              type="datetime-local"
              {...register("eventDate")}
              {...fieldAria("eventDate", errors.eventDate?.message)}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Location" htmlFor="eventLocation" error={errors.eventLocation?.message}>
            <input
              {...register("eventLocation")}
              {...fieldAria("eventLocation", errors.eventLocation?.message)}
              placeholder="e.g. Road 12 park"
              className={fieldInputClass}
            />
          </Field>
        </div>
      )}

      {category === "alert" && (
        <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
          <input type="checkbox" {...register("urgent")} className="mt-0.5 size-4 accent-[var(--destructive)]" />
          <span>
            <span className="block font-semibold">This is urgent and happening now</span>
            <span className="block text-xs text-muted-foreground">
              Shows a red banner to neighbours for 2 hours. Use only for immediate danger.
            </span>
          </span>
        </label>
      )}

      {category !== "poll" && <ImagePicker value={mediaUrl} onChange={setMediaUrl} disabled={isSubmitting} />}

      {kindnessShown && (
        <div role="alert" className="flex gap-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          <HeartHandshake className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Keep it kind, neighbour</p>
            <p className="text-foreground/80">
              Some of this might come across as hurtful. Want to edit it before posting? You can still post as is.
            </p>
          </div>
        </div>
      )}

      {(submitError || !online) && (
        <div role="alert" className="flex gap-3 rounded-xl bg-danger-soft p-3 text-sm">
          {online ? (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          ) : (
            <WifiOff className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          )}
          <p className="text-foreground/85">
            {online ? (
              <>
                <span className="font-bold">Not posted.</span> {submitError} Your draft is kept here.
              </>
            ) : (
              <>
                <span className="font-bold">You&apos;re offline.</span>{" "}
                Your draft is kept here. Post it once you&apos;re back online.
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <EmojiPickerButton
          disabled={isSubmitting}
          onSelect={(emoji) =>
            setValue("message", insertAtCaret(messageEl.current, getValues("message"), emoji), { shouldDirty: true })
          }
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!online}>
            {kindnessShown
              ? "Post anyway"
              : category === "alert"
                ? "Send alert"
                : category === "poll"
                  ? "Post poll"
                  : submitError
                    ? "Try again"
                    : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
