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
import { TALENT_TEAMS, joinTalentNetwork, type TalentTeam } from "@/lib/api/company";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address."),
  team: z.string().min(1, "Choose the team you're most interested in."),
  city: z.string().trim().min(2, "Enter your city.").max(60),
  link: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https:\/\/\S+\.\S+/.test(v), "Paste a full link, starting with https://"),
  note: z.string().trim().max(500).optional(),
});

type Values = z.infer<typeof schema>;

/** Join the talent network: we reach out when a matching role opens. */
export function TalentForm() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { team: "", city: "Lagos" },
  });
  const { errors, isSubmitting } = formState;

  const submit = async (v: Values) => {
    setServerError(null);
    try {
      await joinTalentNetwork({
        name: v.name,
        email: v.email,
        team: v.team as TalentTeam,
        city: v.city,
        link: v.link || undefined,
        note: v.note || undefined,
      });
      setDone(true);
    } catch (err) {
      setServerError(errorMessage(err, "Couldn't save your details. Please try again."));
    }
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-3xl bg-card p-8 text-center text-foreground shadow-xl" role="status">
        <PartyPopper className="mx-auto size-12 text-primary" aria-hidden />
        <h3 className="text-2xl font-bold tracking-tight">You&apos;re in the network</h3>
        <p className="mx-auto max-w-sm text-muted-foreground">We&apos;ll email you when a role that fits you opens up. No spam, promise.</p>
        <PreviewNotice endpoint="careers" className="mx-auto max-w-sm text-left" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4 rounded-3xl bg-card p-6 text-foreground shadow-xl sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="t-name" error={errors.name?.message}>
          <input {...register("name")} {...fieldAria("t-name", errors.name?.message)} autoComplete="name" className={fieldInputClass} />
        </Field>
        <Field label="Email" htmlFor="t-email" error={errors.email?.message}>
          <input {...register("email")} {...fieldAria("t-email", errors.email?.message)} type="email" autoComplete="email" className={fieldInputClass} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Team" htmlFor="t-team" error={errors.team?.message}>
          <select {...register("team")} {...fieldAria("t-team", errors.team?.message)} className={fieldInputClass}>
            <option value="">Choose…</option>
            {TALENT_TEAMS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City" htmlFor="t-city" error={errors.city?.message}>
          <input {...register("city")} {...fieldAria("t-city", errors.city?.message)} autoComplete="address-level2" className={fieldInputClass} />
        </Field>
      </div>
      <Field label="LinkedIn, portfolio or GitHub" htmlFor="t-link" optional error={errors.link?.message}>
        <input {...register("link")} {...fieldAria("t-link", errors.link?.message, true)} type="url" placeholder="https://" className={fieldInputClass} />
      </Field>
      <Field label="Anything else?" htmlFor="t-note" optional>
        <textarea {...register("note")} id="t-note" rows={3} maxLength={500} placeholder="What would you love to build at myHoodora?" className={fieldInputClass} />
      </Field>
      {serverError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
        Join the talent network
      </Button>
    </form>
  );
}
