"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarHeart, CircleSlash } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { MONTHS, daysInMonth, needsFullDate, readBirthInput, spokenBirthAnswer } from "@myhoodora/api-contract/age";
import { fieldInputClass } from "@/components/shared/field";
import { ApiError } from "@/lib/api/client";
import { PRIVACY_EMAIL } from "@/lib/site";

export interface BirthInput {
  year: string;
  month: string;
  day: string;
}

export const EMPTY_BIRTH: BirthInput = { year: "", month: "", day: "" };

interface BirthFieldProps {
  value: BirthInput;
  onChange: (next: BirthInput) => void;
  problem?: string | null;
  /** Keeps ids unique when the field sits in a larger form. */
  idPrefix?: string;
}

/**
 * The age check's question (docs/compliance/ndpa.md §1), year first: a blank year with no default
 * and no hint of the minimum age. The month and day appear only for the one year the year alone
 * can't settle. Once the answer is complete it's read back underneath, because it can't be changed
 * afterwards and an under-18 answer closes the account.
 */
export function BirthField({ value, onChange, problem, idPrefix = "dob" }: BirthFieldProps) {
  const year = value.year.length === 4 ? Number(value.year) : NaN;
  const askDate = !Number.isNaN(year) && needsFullDate(year);
  const read = readBirthInput(askDate ? value : { year: value.year });
  const days = daysInMonth(Number(value.month) || 1, year || undefined);

  return (
    <fieldset className="space-y-2">
      <label htmlFor={`${idPrefix}-year`} className="mb-2 block px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Year you were born
      </label>
      <input
        id={`${idPrefix}-year`}
        inputMode="numeric"
        autoComplete="bday-year"
        placeholder="YYYY"
        maxLength={4}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
        className={fieldInputClass}
        aria-invalid={!!problem && !read.ok}
        aria-describedby={`${idPrefix}-note`}
      />
      {askDate && (
        <div className="grid grid-cols-[1fr_1.6fr] gap-2 pt-1 animate-in fade-in duration-200">
          <label className="sr-only" htmlFor={`${idPrefix}-day`}>
            Day
          </label>
          <select
            id={`${idPrefix}-day`}
            value={value.day}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
            className={fieldInputClass}
            aria-invalid={!!problem && !value.day}
          >
            <option value="">Day</option>
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${idPrefix}-month`}>
            Month
          </label>
          <select
            id={`${idPrefix}-month`}
            value={value.month}
            onChange={(e) => {
              // 31 March → February: keep the day only if the new month has it.
              const keepDay = Number(value.day) <= daysInMonth(Number(e.target.value) || 1, year);
              onChange({ ...value, month: e.target.value, day: keepDay ? value.day : "" });
            }}
            className={fieldInputClass}
            aria-invalid={!!problem && !value.month}
          >
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
      <p id={`${idPrefix}-note`} role={problem ? "alert" : undefined} className={`px-1 text-xs ${problem ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
        {problem ??
          (read.ok
            ? `Born ${read.value.length === 4 ? "in" : "on"} ${spokenBirthAnswer(read.value)}. You won't be able to change this later.`
            : askDate
              ? "And the day and month, please."
              : "We use it once to check you can join, then throw it away.")}
      </p>
    </fieldset>
  );
}

interface AgeCheckFormProps {
  /** Sends the answer to the API. True: old enough. False: under 18 (the account is already closed). */
  onSubmit: (birthDate: string) => Promise<boolean>;
}

/** The age check on its own screen: for Google and Apple sign-ups, and accounts from before it existed. */
export function AgeCheckForm({ onSubmit }: AgeCheckFormProps) {
  const [value, setValue] = useState<BirthInput>(EMPTY_BIRTH);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const read = readBirthInput(value);
    if (!read.ok) {
      setProblem(read.problem);
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      // Under 18 the parent swaps this form for the "can't join" screen; nothing more to do here.
      await onSubmit(read.value);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "We couldn't check that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarHeart className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">When were you born?</h1>
        <p className="text-sm text-muted-foreground">We ask everyone once before they join. Only the result is kept.</p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <BirthField
          value={value}
          onChange={(next) => {
            setValue(next);
            setProblem(null);
          }}
          problem={problem}
        />
        <Button type="submit" className="w-full" loading={busy}>
          Continue
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Why we ask:{" "}
          <Link href="/privacy#children" target="_blank" className="font-semibold underline hover:text-primary">
            Privacy Policy
          </Link>
        </p>
      </form>
    </div>
  );
}

/** Shown once someone has said they're under 18, and on this browser for a while after (age-lock.ts). */
export function CantJoinYet() {
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CircleSlash className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Sorry, you can&apos;t join myHoodora yet</h1>
      <p className="text-sm text-muted-foreground">
        myHoodora is for adults, so we can&apos;t give you an account. We haven&apos;t kept your date of birth, and anything you&apos;d already given us is being deleted.
      </p>
      <p className="text-sm text-muted-foreground">
        Think there&apos;s been a mistake? Email{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-primary hover:underline">
          {PRIVACY_EMAIL}
        </a>
        .
      </p>
      <Link href="/" className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-muted">
        Back to the home page
      </Link>
    </div>
  );
}
