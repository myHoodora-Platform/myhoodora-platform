"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Lock, MapPin, ShieldAlert, ShoppingBag, Users } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const LOCKED = [
  { icon: ShieldAlert, label: "Alerts from neighbours" },
  { icon: CalendarDays, label: "Local events" },
  { icon: Users, label: "Groups" },
  { icon: ShoppingBag, label: "For Sale & Free" },
];

/**
 * Shown in place of the feed for someone who skipped onboarding: they have
 * no neighbourhood yet, so there's nothing to show until they join one.
 */
export function FinishJoiningCard() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative bg-primary px-6 py-8 text-primary-foreground sm:px-8">
        <span aria-hidden className="absolute -top-12 -right-12 size-44 rounded-full bg-white/10" />
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <MapPin className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Finish joining your neighbourhood</h1>
        <p className="mt-1 max-w-md text-primary-foreground/85">
          Confirm where you live to see what neighbours are sharing, and to post, comment and message. It takes about a minute.
        </p>
        <Link
          href={ROUTES.onboarding}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-bold text-primary transition-colors hover:bg-white/90"
        >
          Find my neighbourhood <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="space-y-3 p-6 sm:px-8">
        <p className="text-sm font-bold">Unlocks when you&apos;re verified</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {LOCKED.map((f) => (
            <li key={f.label} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm font-medium">
              <f.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="flex-1">{f.label}</span>
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Your address stays private. Neighbours only ever see your neighbourhood&apos;s name.</p>
      </div>
    </section>
  );
}
