"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, PartyPopper } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { PreviewNotice } from "@/components/shared/states";
import { errorMessage } from "@/lib/api/client";
import { INSTITUTION_TYPES, submitAiPilotRequest, type InstitutionType } from "@/lib/api/hoodora-ai";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address."),
  institution: z.string().trim().min(2, "Enter your school or organisation.").max(120),
  institutionType: z.string().min(1, "Choose what kind of organisation it is."),
  role: z.string().trim().max(80).optional(),
  subjects: z.string().trim().max(300).optional(),
});

type Values = z.infer<typeof schema>;

/** "Join the pilot" waitlist form for schools, lecturers and L&D teams. */
export function AiPilotForm() {
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { institutionType: "" },
  });
  const { errors, isSubmitting } = formState;

  const submit = async (v: Values) => {
    setServerError(null);
    try {
      await submitAiPilotRequest({
        name: v.name,
        email: v.email,
        institution: v.institution,
        institutionType: v.institutionType as InstitutionType,
        role: v.role || undefined,
        subjects: v.subjects || undefined,
      });
      setDone(v.institution);
    } catch (err) {
      setServerError(errorMessage(err, "Couldn't send your request. Please try again."));
    }
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-center" role="status">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PartyPopper className="size-8" aria-hidden />
        </span>
        <h3 className="text-2xl font-bold tracking-tight">You&apos;re on the list</h3>
        <p className="mx-auto max-w-sm text-muted-foreground">
          Thanks! We&apos;ll email you when pilot places open for {done}, with a short guide to preparing your first lecture.
        </p>
        <PreviewNotice endpoint="ai.pilot" className="mx-auto max-w-sm text-left" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="ai-name" error={errors.name?.message}>
          <input {...register("name")} {...fieldAria("ai-name", errors.name?.message)} autoComplete="name" className={fieldInputClass} />
        </Field>
        <Field label="Work email" htmlFor="ai-email" error={errors.email?.message}>
          <input {...register("email")} {...fieldAria("ai-email", errors.email?.message)} type="email" autoComplete="email" className={fieldInputClass} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School or organisation" htmlFor="ai-inst" error={errors.institution?.message}>
          <input
            {...register("institution")}
            {...fieldAria("ai-inst", errors.institution?.message)}
            autoComplete="organization"
            placeholder="e.g. University of Ibadan"
            className={fieldInputClass}
          />
        </Field>
        <Field label="Type" htmlFor="ai-type" error={errors.institutionType?.message}>
          <select {...register("institutionType")} {...fieldAria("ai-type", errors.institutionType?.message)} className={fieldInputClass}>
            <option value="">Choose…</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Your role" htmlFor="ai-role" optional>
        <input {...register("role")} id="ai-role" placeholder="e.g. Lecturer, Biochemistry" className={fieldInputClass} />
      </Field>
      <Field label="What would you convert first?" htmlFor="ai-subjects" optional hint="A course, topic or class. It helps us plan the pilot.">
        <textarea
          {...register("subjects")}
          id="ai-subjects"
          rows={3}
          maxLength={300}
          placeholder="e.g. JSS2 Basic Science: photosynthesis and the water cycle"
          className={fieldInputClass}
        />
      </Field>
      {serverError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
        Join the pilot waitlist
      </Button>
      <p className="text-center text-xs text-muted-foreground">We&apos;ll only use your details to contact you about the pilot.</p>
    </form>
  );
}
