"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { ImagePicker } from "@/components/shared/image-picker";
import { ROUTES } from "@/lib/routes";
import type { CreateGroupInput, GroupCategory } from "@/lib/api/types";
import { BOUNDARY_OPTIONS, GROUP_CATEGORY, PRIVACY_OPTIONS } from "./constants";

const baseSchema = z.object({
  name: z.string().trim().min(3, "Give your group a name (at least 3 characters).").max(60, "Keep the name under 60 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Tell neighbours what the group is for (at least 10 characters).")
    .max(500, "Keep the description under 500 characters."),
  category: z.enum(["safety", "estate", "parents", "hobbies", "business", "other"], {
    errorMap: () => ({ message: "Choose a category." }),
  }),
  privacy: z.enum(["open", "private"]),
  boundary: z.enum(["neighbourhood", "nearby", "city"]),
  agree: z.boolean().optional(),
});

/** Every rule (including the guidelines tick) is checked in one pass, so all problems show at once. */
function schemaFor(mode: "create" | "edit") {
  return baseSchema.superRefine((v, ctx) => {
    if (mode === "create" && !v.agree) {
      ctx.addIssue({ code: "custom", path: ["agree"], message: "Please agree to the group guidelines." });
    }
  });
}

type FormValues = z.infer<typeof baseSchema>;

/** Bring the first problem into view — the submit button is at the bottom of a long form. */
function scrollToFirstError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    const first = form?.querySelector<HTMLElement>("[data-field-error], [aria-invalid='true']");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

interface GroupFormProps {
  mode: "create" | "edit";
  initial?: Partial<CreateGroupInput>;
  submitLabel: string;
  onSubmit: (input: CreateGroupInput) => Promise<void>;
  onCancel: () => void;
}

/** Shared by "Create group" and the admin "Edit details" tab. */
export function GroupForm({ mode, initial, submitLabel, onSubmit, onCancel }: GroupFormProps) {
  const [cover, setCover] = useState<string | null>(initial?.coverPhoto ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schemaFor(mode)),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      category: initial?.category as GroupCategory | undefined,
      privacy: initial?.privacy ?? "private",
      boundary: initial?.boundary ?? "neighbourhood",
      agree: mode === "edit",
    },
  });
  const { errors, isSubmitting } = formState;
  const [category, privacy, boundary, description] = watch(["category", "privacy", "boundary", "description"]);

  const submit = async (v: FormValues) => {
    setServerError(null);
    try {
      await onSubmit({
        name: v.name.trim(),
        description: v.description.trim(),
        category: v.category,
        privacy: v.privacy,
        boundary: v.boundary,
        coverPhoto: cover ?? undefined,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save the group. Please try again.");
      scrollToFirstError(formRef.current);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(submit, () => scrollToFirstError(formRef.current))}
      className="space-y-6"
      noValidate
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-bold">About the group</h2>
        <Field label="Group name" htmlFor="group-name" error={errors.name?.message} hint="e.g. “Road 12 Residents”, “Lekki Runners”">
          <input {...register("name")} {...fieldAria("group-name", errors.name?.message, true)} maxLength={60} className={fieldInputClass} />
        </Field>
        <Field
          label="Description"
          htmlFor="group-description"
          error={errors.description?.message}
          hint={`${description?.length ?? 0}/500 · What it's for, who should join, any house rules.`}
        >
          <textarea
            {...register("description")}
            {...fieldAria("group-description", errors.description?.message, true)}
            rows={4}
            maxLength={500}
            className={cn(fieldInputClass, "resize-y")}
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Category</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GROUP_CATEGORY) as GroupCategory[]).map((id) => {
              const c = GROUP_CATEGORY[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={category === id}
                  onClick={() => setValue("category", id, { shouldValidate: true })}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                    category === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                  )}
                >
                  <c.icon className="size-4" aria-hidden />
                  {c.label}
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p data-field-error className="text-xs font-semibold text-destructive">
              {errors.category.message}
            </p>
          )}
        </fieldset>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">
            Cover photo <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <ImagePicker value={cover} onChange={setCover} purpose="group" disabled={isSubmitting} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-bold">Who can join</h2>
        <div role="radiogroup" aria-label="Privacy" className="grid gap-3 sm:grid-cols-2">
          {PRIVACY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={privacy === o.id}
              onClick={() => setValue("privacy", o.id)}
              className={cn(
                "space-y-2 rounded-xl border p-4 text-left transition-colors",
                privacy === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold">
                  <o.icon className="size-4 text-primary" aria-hidden /> {o.label}
                </span>
                {privacy === o.id && <CheckCircle2 className="size-5 text-primary" aria-hidden />}
              </span>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {o.points.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        {mode === "edit" && initial?.privacy === "private" && privacy === "open" && (
          <p className="text-xs font-semibold text-warning">Anyone waiting for approval will be let in when you save.</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-bold">Who can find it</h2>
        <div role="radiogroup" aria-label="Who can find the group" className="space-y-2">
          {BOUNDARY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={boundary === o.id}
              onClick={() => setValue("boundary", o.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                boundary === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50",
              )}
            >
              <o.icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{o.label}</span>
                <span className="block text-sm text-muted-foreground">{o.description}</span>
              </span>
              {boundary === o.id && <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </section>

      {mode === "create" && (
        <div className="space-y-1">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...register("agree")} className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              I&apos;ll run this group in line with the{" "}
              <Link href={ROUTES.guidelines} target="_blank" className="font-semibold text-primary hover:underline">
                community guidelines
              </Link>
              : no discrimination, harassment or scams. As admin I&apos;m responsible for what&apos;s allowed.
            </span>
          </label>
          {errors.agree && (
            <p data-field-error className="pl-7 text-xs font-semibold text-destructive">
              {errors.agree.message}
            </p>
          )}
        </div>
      )}

      {serverError && (
        <p role="alert" data-field-error className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
