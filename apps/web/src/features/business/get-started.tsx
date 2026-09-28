"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, ArrowRight, Check, PartyPopper, Store } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { PreviewNotice } from "@/components/shared/states";
import { errorMessage } from "@/lib/api/client";
import {
  BUSINESS_CATEGORIES,
  isValidCacNumber,
  normaliseNigerianPhone,
  submitBusinessApplication,
  type BusinessCategory,
} from "@/lib/api/business";
import { COVERAGE } from "@/lib/coverage";

const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(80),
  category: z.string().min(1, "Choose what kind of business it is."),
  description: z.string().trim().min(20, "Tell neighbours what you offer (at least 20 characters).").max(300),
  areasServed: z.array(z.string()).min(1, "Choose at least one neighbourhood you serve."),
  address: z.string().trim().max(160).optional(),
  contactName: z.string().trim().min(2, "Enter your name."),
  phone: z.string().refine((v) => normaliseNigerianPhone(v) !== null, "Enter a Nigerian mobile number, e.g. 0803 123 4567."),
  email: z.string().trim().email("Enter a valid email address."),
  cacNumber: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidCacNumber(v), "CAC numbers look like RC123456 or BN1234567."),
  wantsAdsUpdates: z.boolean(),
  agree: z.boolean().refine((v) => v, "Please agree to the terms."),
});

type Values = z.infer<typeof schema>;

const STEPS = [
  { title: "Your business", fields: ["businessName", "category", "description"] },
  { title: "Where you work", fields: ["areasServed", "address"] },
  { title: "Contact & verification", fields: ["contactName", "phone", "email", "cacNumber", "agree"] },
] as const;

export function GetStartedFlow() {
  const wantsAds = useSearchParams().get("interest") === "ads";
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<{ name: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, trigger, watch, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { areasServed: [], wantsAdsUpdates: wantsAds, agree: false, category: "" },
  });
  const { errors, isSubmitting } = formState;
  const areas = watch("areasServed");

  const next = async () => {
    const ok = await trigger(STEPS[step]!.fields as unknown as (keyof Values)[]);
    if (ok) setStep((s) => s + 1);
  };

  const submit = async (v: Values) => {
    setServerError(null);
    try {
      await submitBusinessApplication({
        businessName: v.businessName,
        category: v.category as BusinessCategory,
        description: v.description,
        areasServed: v.areasServed,
        address: v.address || undefined,
        contactName: v.contactName,
        phone: normaliseNigerianPhone(v.phone)!,
        email: v.email,
        cacNumber: v.cacNumber ? v.cacNumber.replace(/\s/g, "").toUpperCase() : undefined,
        wantsAdsUpdates: v.wantsAdsUpdates,
      });
      setDone({ name: v.businessName });
    } catch (err) {
      setServerError(errorMessage(err, "Couldn't send your details. Please try again."));
    }
  };

  const toggleArea = (area: string) =>
    setValue("areasServed", areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area], {
      shouldValidate: true,
    });

  if (done) {
    return (
      <div className="space-y-6 text-center" role="status">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PartyPopper className="size-10" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{done.name} is on its way to myHoodora</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          We&apos;ll confirm your phone number and details, then email you a link to set up your free Business Page and start
          posting to neighbours. This usually takes 1–2 working days.
        </p>
        <PreviewNotice endpoint="business" className="mx-auto max-w-md text-left" />
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/business" className="inline-flex h-12 items-center justify-center rounded-full border border-border px-6 font-semibold hover:bg-muted">
            Back to myHoodora for Business
          </Link>
          <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90">
            Also join as a neighbour
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
          <Store className="size-3.5" aria-hidden /> Free Business Page
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Put your business on myHoodora</h1>
        <div className="flex gap-2" aria-label={`Step ${step + 1} of 3`}>
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          Step {step + 1} of 3 · {STEPS[step]!.title}
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        {step === 0 && (
          <>
            <Field label="Business name" htmlFor="biz-name" error={errors.businessName?.message}>
              <input {...register("businessName")} {...fieldAria("biz-name", errors.businessName?.message)} placeholder="e.g. Femi Electricals" className={fieldInputClass} />
            </Field>
            <Field label="What kind of business?" htmlFor="biz-category" error={errors.category?.message}>
              <select {...register("category")} {...fieldAria("biz-category", errors.category?.message)} className={fieldInputClass}>
                <option value="">Choose…</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What do you offer?" htmlFor="biz-desc" error={errors.description?.message} hint="This appears on your Business Page. Up to 300 characters.">
              <textarea
                {...register("description")}
                {...fieldAria("biz-desc", errors.description?.message, true)}
                rows={4}
                maxLength={300}
                placeholder="e.g. Inverter, solar and house wiring. Same-day fault finding across Lekki and VI."
                className={fieldInputClass}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Neighbourhoods you serve</legend>
              <p className="text-xs text-muted-foreground">Neighbours here will see your posts. Choose as many as you like.</p>
              {COVERAGE.map((c) => (
                <div key={c.city} className="space-y-2">
                  <p className="text-sm font-bold">{c.city}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.areas.map((a) => {
                      const on = areas.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleArea(a)}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
                            on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                          )}
                        >
                          {on && <Check className="size-3.5" aria-hidden />} {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {errors.areasServed && <p className="text-xs font-semibold text-destructive">{errors.areasServed.message}</p>}
            </fieldset>
            <Field label="Business address" htmlFor="biz-address" optional hint="If customers can visit you. Leave blank if you go to them.">
              <input {...register("address")} id="biz-address" placeholder="e.g. Shop 4, Admiralty Mall, Lekki Phase 1" className={fieldInputClass} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Your name" htmlFor="biz-contact" error={errors.contactName?.message}>
              <input {...register("contactName")} {...fieldAria("biz-contact", errors.contactName?.message)} autoComplete="name" className={fieldInputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone (for verification)" htmlFor="biz-phone" error={errors.phone?.message}>
                <input {...register("phone")} {...fieldAria("biz-phone", errors.phone?.message)} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" className={fieldInputClass} />
              </Field>
              <Field label="Email" htmlFor="biz-email" error={errors.email?.message}>
                <input {...register("email")} {...fieldAria("biz-email", errors.email?.message)} type="email" autoComplete="email" className={fieldInputClass} />
              </Field>
            </div>
            <Field label="CAC number" htmlFor="biz-cac" optional error={errors.cacNumber?.message} hint="RC or BN number. Not registered? No problem, leave it blank.">
              <input {...register("cacNumber")} {...fieldAria("biz-cac", errors.cacNumber?.message, true)} placeholder="e.g. RC123456" className={fieldInputClass} />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" {...register("wantsAdsUpdates")} className="mt-0.5 size-4 accent-[var(--primary)]" />
              Tell me when Local Ads launch
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" {...register("agree")} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-primary hover:underline">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/guidelines" target="_blank" className="font-semibold text-primary hover:underline">
                  Community Guidelines
                </Link>
                , and that my details are handled as described in the{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agree && <p className="text-xs font-semibold text-destructive">{errors.agree.message}</p>}
          </>
        )}
      </div>

      {serverError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {step > 0 && (
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        )}
        {step < 2 ? (
          <Button size="lg" className="w-full sm:flex-1" onClick={() => void next()}>
            Continue <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="lg" className="w-full sm:flex-1" loading={isSubmitting}>
            Create my Business Page
          </Button>
        )}
      </div>
    </form>
  );
}

export function GetStartedHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-8">
      <Link href="/business" aria-label="myHoodora for Business">
        <MascotWordmark size="sm" />
      </Link>
      <Link href="/business" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
        Cancel
      </Link>
    </header>
  );
}
