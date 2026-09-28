"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, HeartHandshake } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { EmojiPickerButton } from "@/components/shared/emoji-picker-button";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { ImagePicker } from "@/components/shared/image-picker";
import { errorMessage } from "@/lib/api/client";
import type { AlertCategory, Post, PostCategory } from "@/lib/api/types";
import { ALERT_CATEGORIES, POST_CATEGORIES, categoryDef } from "../categories";
import { needsKindnessReminder } from "../kindness";
import { useFeed } from "../feed-context";

const schema = z
  .object({
    category: z.enum(["general", "recommendation", "alert", "event", "for_sale", "lost_found", "thanks"]),
    message: z.string().trim().min(1, "Write something to share.").max(3000, "Keep it under 3,000 characters."),
    alertCategory: z.string().optional(),
    urgent: z.boolean().optional(),
    eventDate: z.string().optional(),
    eventLocation: z.string().trim().optional(),
    thankedName: z.string().trim().optional(),
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
  const [step, setStep] = useState<"pick" | "write">(initialCategory ? "write" : "pick");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [kindnessShown, setKindnessShown] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: initialCategory ?? "general", message: "", urgent: false },
  });
  const { register, handleSubmit, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;
  const category = watch("category");
  const alertCategory = watch("alertCategory");
  const def = categoryDef(category);

  const pick = (id: PostCategory) => {
    if (id === "for_sale") return onSell();
    setValue("category", id);
    setStep("write");
  };

  const submit = async (values: FormValues) => {
    if (!kindnessShown && needsKindnessReminder(values.message)) {
      setKindnessShown(true);
      return;
    }
    try {
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
        },
      });
      toast.success(values.category === "alert" ? "Alert sent to your neighbours." : "Posted to your neighbourhood.");
      onDone(post);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't post. Please try again."));
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

      <Field label="Your post" htmlFor="message" error={errors.message?.message}>
        <textarea
          {...messageReg}
          {...fieldAria("message", errors.message?.message)}
          rows={5}
          autoFocus
          placeholder={PLACEHOLDERS[category]}
          className={cn(fieldInputClass, "min-h-32 resize-y")}
          onChange={(e) => {
            void messageReg.onChange(e);
            setKindnessShown(false);
          }}
        />
      </Field>

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

      <ImagePicker value={mediaUrl} onChange={setMediaUrl} disabled={isSubmitting} />

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

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <EmojiPickerButton
          disabled={isSubmitting}
          onSelect={(emoji) => setValue("message", `${form.getValues("message")}${emoji}`)}
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {kindnessShown ? "Post anyway" : category === "alert" ? "Send alert" : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
