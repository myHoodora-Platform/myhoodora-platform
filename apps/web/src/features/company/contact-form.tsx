"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Handshake,
  HelpCircle,
  Newspaper,
  ShieldAlert,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { PreviewNotice } from "@/components/shared/states";
import { errorMessage } from "@/lib/api/client";
import { sendContactMessage, type ContactTopic } from "@/lib/api/company";

const TOPICS: { id: ContactTopic; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "general", label: "General question", hint: "Anything about myHoodora", icon: HelpCircle },
  { id: "account", label: "Account & verification", hint: "Signing in, verifying your address", icon: UserCheck },
  { id: "safety", label: "Safety concern", hint: "Something on myHoodora worries you", icon: ShieldAlert },
  { id: "business", label: "Business & estates", hint: "Business Pages, estate pages", icon: Building2 },
  { id: "press", label: "Press & media", hint: "Interviews, stories, assets", icon: Newspaper },
  { id: "partnerships", label: "Partnerships", hint: "Work with us", icon: Handshake },
  { id: "ai", label: "myHoodora AI", hint: "Schools, lecturers, the pilot", icon: Sparkles },
];

const schema = z.object({
  topic: z.string().min(1, "Choose what it's about."),
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address."),
  organisation: z.string().trim().max(120).optional(),
  message: z.string().trim().min(20, "Tell us a little more (at least 20 characters).").max(2000),
});

type Values = z.infer<typeof schema>;

export function ContactForm({ initialTopic }: { initialTopic?: ContactTopic }) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { topic: initialTopic ?? "" },
  });
  const { errors, isSubmitting } = formState;
  const topic = watch("topic") as ContactTopic | "";
  const needsOrg = topic === "press" || topic === "partnerships" || topic === "business" || topic === "ai";

  const submit = async (v: Values) => {
    setServerError(null);
    try {
      await sendContactMessage({
        topic: v.topic as ContactTopic,
        name: v.name,
        email: v.email,
        message: v.message,
        organisation: v.organisation || undefined,
      });
      setSent(true);
    } catch (err) {
      setServerError(errorMessage(err, "Couldn't send your message. Please try again."));
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-center shadow-sm" role="status">
        <CheckCircle2 className="mx-auto size-14 text-primary" aria-hidden />
        <h2 className="text-2xl font-bold tracking-tight">Message sent</h2>
        <p className="mx-auto max-w-sm text-muted-foreground">
          Thanks for getting in touch. We usually reply within 1–2 working days, to the email you gave us.
        </p>
        <PreviewNotice endpoint="contact" className="mx-auto max-w-sm text-left" />
        <Button variant="outline" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <fieldset className="space-y-3">
        <legend className="text-lg font-bold">What&apos;s it about?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOPICS.map((t) => {
            const on = topic === t.id;
            return (
              <label
                key={t.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                  on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  value={t.id}
                  checked={on}
                  onChange={() => setValue("topic", t.id, { shouldValidate: true })}
                  className="sr-only"
                  name="topic"
                />
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  <t.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.topic && <p className="text-xs font-semibold text-destructive">{errors.topic.message}</p>}
        {topic === "safety" && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft/60 p-3 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <span>
              If anyone is in danger, call <strong>112</strong> now. To report a post or person, use Report in the app, it
              reaches our team fastest.
            </span>
          </p>
        )}
        {topic === "account" && (
          <p className="text-sm text-muted-foreground">
            Tip: most account questions are answered in the{" "}
            <Link href="/help" className="font-semibold text-primary hover:underline">
              Help centre
            </Link>
            .
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" error={errors.name?.message}>
          <input {...register("name")} {...fieldAria("c-name", errors.name?.message)} autoComplete="name" className={fieldInputClass} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={errors.email?.message}>
          <input {...register("email")} {...fieldAria("c-email", errors.email?.message)} type="email" autoComplete="email" className={fieldInputClass} />
        </Field>
      </div>
      {needsOrg && (
        <Field label="Organisation" htmlFor="c-org" optional>
          <input {...register("organisation")} id="c-org" autoComplete="organization" placeholder="e.g. your publication, school or company" className={fieldInputClass} />
        </Field>
      )}
      <Field label="Message" htmlFor="c-msg" error={errors.message?.message}>
        <textarea
          {...register("message")}
          {...fieldAria("c-msg", errors.message?.message)}
          rows={5}
          maxLength={2000}
          placeholder="How can we help?"
          className={fieldInputClass}
        />
      </Field>
      {serverError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
        Send message
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We handle your details as described in our{" "}
        <Link href="/privacy" className="underline hover:text-primary">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
