import { Check, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { cn } from "@myhoodora/ui/utils";

export const ONBOARDING_STEPS = [
  { title: "Your details", desc: "Name and address" },
  { title: "Confirm on the map", desc: "Make sure we've got it right" },
  { title: "Verification", desc: "Join your neighbourhood" },
] as const;

const PRIVACY_POINTS = [
  { icon: EyeOff, text: "Neighbours only ever see your neighbourhood's name, never your address." },
  { icon: ShieldCheck, text: "We use your location once, to confirm you really live there." },
  { icon: Lock, text: "We never sell your data or share your address with anyone." },
];

interface OnboardingShellProps {
  step: number;
  onSkip?: () => void;
  children: React.ReactNode;
}

/**
 * Desktop: brand panel (progress + why we ask for your address) beside the
 * form. Phones: compact header with a segmented progress bar.
 */
export function OnboardingShell({ step, onSkip, children }: OnboardingShellProps) {
  return (
    <div className="flex min-h-dvh bg-canvas font-sans text-foreground">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-[380px] shrink-0 flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div aria-hidden className="absolute -right-24 -bottom-24 size-80 rounded-full bg-white/10" />
        <div className="relative space-y-10">
          <MascotWordmark size="md" tone="reversed" />
          <ol className="space-y-6" aria-label="Onboarding progress">
            {ONBOARDING_STEPS.map((s, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <li key={s.title} className="flex items-start gap-4" aria-current={active ? "step" : undefined}>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                      done && "border-white bg-white text-primary",
                      active && "border-white text-white",
                      !done && !active && "border-white/30 text-white/50",
                    )}
                  >
                    {done ? <Check className="size-4" aria-hidden /> : n}
                  </span>
                  <span>
                    <span className={cn("block font-bold", !active && !done && "text-white/60")}>{s.title}</span>
                    <span className="block text-sm text-white/70">{s.desc}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="relative space-y-3 rounded-2xl bg-white/10 p-5">
          <p className="font-bold">Why we ask for your address</p>
          <ul className="space-y-3 text-sm text-white/85">
            {PRIVACY_POINTS.map((p) => (
              <li key={p.text} className="flex gap-3">
                <p.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-8 lg:border-none lg:bg-transparent lg:pt-8">
          <span className="lg:invisible">
            <MascotWordmark size="sm" />
          </span>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Skip for now
            </button>
          )}
        </header>

        {/* Progress (phones & tablets) */}
        <div className="px-4 pt-4 sm:px-8 lg:hidden" aria-label={`Step ${Math.min(step, 3)} of 3`}>
          <div className="flex gap-2">
            {ONBOARDING_STEPS.map((s, i) => (
              <span key={s.title} className={cn("h-1.5 flex-1 rounded-full", step > i ? "bg-primary" : "bg-border")} />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Step {Math.min(step, 3)} of 3 · {ONBOARDING_STEPS[Math.min(step, 3) - 1]?.title}
          </p>
        </div>

        <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-8 sm:py-10 lg:items-center">
          <div className="w-full max-w-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Mobile-only privacy reassurance (the desktop panel shows the full list). */
export function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2.5 text-sm text-foreground/80 lg:hidden">
      <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      Your address is private. Neighbours only see your neighbourhood&apos;s name.
    </p>
  );
}
