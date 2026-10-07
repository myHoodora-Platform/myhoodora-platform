import { cn } from "@myhoodora/ui/utils";

/** Bordered input style for in-app forms (auth pages keep their own look). 16px on phones: iOS zooms in on anything smaller. */
export const fieldInputClass =
  "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base text-foreground sm:text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-50 aria-[invalid=true]:border-destructive";

interface FieldProps {
  label: string;
  htmlFor: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + hint/error, wired for screen readers via ids. */
export function Field({ label, htmlFor, optional, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** aria props linking a control to its Field's error/hint text. */
export function fieldAria(id: string, error?: string, hasHint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}
