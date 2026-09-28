"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, LocateFixed, MapPin, PartyPopper, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { COVERAGE } from "@/lib/coverage";
import { LocationMap } from "./location-map";
import { PrivacyNote } from "./onboarding-shell";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft p-4 text-sm font-medium text-foreground">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

// ── Step 1: name + address ──────────────────────────────────────────────────

interface DetailsStepProps {
  name: string;
  address: string;
  hasCoords: boolean;
  detecting: boolean;
  geocoding: boolean;
  error: string | null;
  onName: (v: string) => void;
  onAddress: (v: string) => void;
  onDetect: () => void;
  onNext: () => void;
}

export function DetailsStep({ name, address, hasCoords, detecting, geocoding, error, onName, onAddress, onDetect, onNext }: DetailsStepProps) {
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      noValidate
    >
      <StepHeading
        title="Let's find your neighbourhood"
        description="Tell us your name and where you live, and we'll connect you with verified neighbours nearby."
      />
      {error && <ErrorBanner message={error} />}

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Field label="Your name" htmlFor="onb-name" hint="Use the name your neighbours know you by.">
          <input
            {...fieldAria("onb-name", undefined, true)}
            value={name}
            onChange={(e) => onName(e.target.value)}
            autoComplete="name"
            placeholder="e.g. Adaeze Okafor"
            className={fieldInputClass}
          />
        </Field>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Where do you live?</p>
          <button
            type="button"
            onClick={onDetect}
            disabled={detecting}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-70",
              hasCoords ? "border-primary bg-primary/5" : "border-primary/30 hover:border-primary hover:bg-primary/5",
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {detecting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{detecting ? "Finding your location…" : "Use my current location"}</span>
              <span className="block text-sm text-muted-foreground">
                {hasCoords ? "Location found. Check the address below." : "Fastest and most accurate, best done at home"}
              </span>
            </span>
            {hasCoords && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
          </button>

          <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" /> or type it <span className="h-px flex-1 bg-border" />
          </div>

          <Field label="Home address" htmlFor="onb-address" hint="Street, area and city is enough.">
            <input
              {...fieldAria("onb-address", undefined, true)}
              value={address}
              onChange={(e) => onAddress(e.target.value)}
              autoComplete="street-address"
              placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
              className={fieldInputClass}
            />
          </Field>
        </div>
      </div>

      <PrivacyNote />

      <Button type="submit" size="lg" className="w-full" loading={geocoding}>
        Continue <ArrowRight className="size-4" aria-hidden />
      </Button>
    </form>
  );
}

// ── Step 2: confirm on the map ──────────────────────────────────────────────

interface ConfirmStepProps {
  address: string;
  coords: { lat: number; lng: number } | null;
  onBack: () => void;
  onNext: () => void;
}

export function ConfirmStep({ address, coords, onBack, onNext }: ConfirmStepProps) {
  return (
    <div className="space-y-6">
      <StepHeading title="Is this your home?" description="Check the pin is in the right place. This is how we match you to your neighbourhood." />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-64 w-full bg-muted sm:h-72">{coords && <LocationMap lat={coords.lat} lng={coords.lng} />}</div>
        <div className="flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Your address</p>
            <p className="text-sm text-muted-foreground">{address}</p>
          </div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <Pencil className="size-3.5" aria-hidden /> Edit
          </button>
        </div>
      </div>
      <PrivacyNote />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <Button size="lg" className="w-full sm:flex-1" onClick={onNext}>
          Yes, verify my neighbourhood <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: verification ────────────────────────────────────────────────────

type Outcome = "pending" | "success" | "unverified" | "error";

interface VerifyStepProps {
  /** Real milestones set by runVerification: 1 coords, 2 location check, 3 saving, 4 done. */
  status: number;
  outcome: Outcome;
  neighbourhoodName: string | null;
  onRetry: () => void;
  onEditAddress: () => void;
  onContinue: () => void;
}

function CheckItem({ label, state }: { label: string; state: "waiting" | "active" | "done" | "failed" }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          state === "done" && "bg-primary text-primary-foreground",
          state === "active" && "bg-primary/15 text-primary",
          state === "failed" && "bg-destructive text-white",
          state === "waiting" && "bg-muted text-muted-foreground",
        )}
      >
        {state === "done" ? <Check className="size-3.5" aria-hidden /> : state === "failed" ? "!" : state === "active" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : ""}
      </span>
      <span className={cn(state === "waiting" ? "text-muted-foreground" : "font-semibold")}>{label}</span>
    </li>
  );
}

export function VerifyStep({ status, outcome, neighbourhoodName, onRetry, onEditAddress, onContinue }: VerifyStepProps) {
  const item = (activeAt: number, failed = false): "waiting" | "active" | "done" | "failed" =>
    failed ? "failed" : status > activeAt ? "done" : status === activeAt ? "active" : "waiting";

  if (outcome === "success") {
    return (
      <div className="space-y-6 text-center" role="status">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PartyPopper className="size-10" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to {neighbourhoodName ?? "your neighbourhood"}!</h1>
          <p className="text-muted-foreground">You&apos;re a verified neighbour. Taking you to your feed…</p>
        </div>
        <Button size="lg" onClick={onContinue}>
          Go to my feed <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  if (outcome === "unverified") {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-soft text-warning">
            <MapPin className="size-8" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">We&apos;re not in your area yet</h1>
          <p className="text-muted-foreground">
            Your details are saved. We&apos;re opening new neighbourhoods as residents join. Here&apos;s where we&apos;re live today:
          </p>
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          {COVERAGE.map((c) => (
            <div key={c.city}>
              <p className="text-sm font-bold">{c.city}</p>
              <p className="text-sm text-muted-foreground">{c.areas.join(" · ")}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Live in one of these? Your pin may be slightly off. Try editing your address.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button variant="outline" size="lg" className="w-full sm:flex-1" onClick={onEditAddress}>
            <Pencil className="size-4" aria-hidden /> Edit address
          </Button>
          <Button size="lg" className="w-full sm:flex-1" onClick={onContinue}>
            Continue to myHoodora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full",
            outcome === "error" ? "bg-danger-soft text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <ShieldCheck className={cn("size-8", outcome === "pending" && "animate-pulse")} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          {outcome === "error" ? "We couldn't check your location" : "Verifying your neighbourhood"}
        </h1>
        <p className="text-muted-foreground">
          {outcome === "error"
            ? "Your details are saved. This was just the location check, usually a connection problem. Try again, or continue and verify later."
            : "This only takes a moment."}
        </p>
      </div>

      <ol className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-live="polite">
        <CheckItem label="Checking your address" state={item(1)} />
        <CheckItem label="Matching you to a neighbourhood" state={item(2, status >= 3 && outcome === "error")} />
        <CheckItem label="Setting up your feed" state={item(3)} />
      </ol>

      {outcome === "error" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" size="lg" className="w-full sm:flex-1" onClick={onEditAddress}>
              <Pencil className="size-4" aria-hidden /> Edit address
            </Button>
            <Button size="lg" className="w-full sm:flex-1" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden /> Try again
            </Button>
          </div>
          <button type="button" onClick={onContinue} className="w-full text-sm font-semibold text-muted-foreground hover:text-foreground">
            Continue and verify later
          </button>
        </div>
      )}

      {outcome === "pending" && (
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/guidelines" target="_blank" className="font-semibold text-primary hover:underline">
            community guidelines
          </Link>
          .
        </p>
      )}
    </div>
  );
}
