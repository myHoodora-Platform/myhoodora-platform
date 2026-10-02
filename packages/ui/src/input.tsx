import React from "react";
import { cn } from "./utils";

const baseClasses =
  "w-full rounded-xl border-2 border-transparent bg-card px-4 py-3 text-foreground shadow-sm outline-none transition-all focus:border-primary focus:ring-0";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    // Ties the message to the field, so a screen reader reads it with the input, not somewhere after it.
    const errorId = React.useId();
    return (
      <div className="w-full flex flex-col gap-1.5">
        <input
          ref={ref}
          className={cn(
            baseClasses,
            error ? "border-destructive focus:border-destructive" : "",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          <div id={errorId} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-destructive px-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="size-4 shrink-0"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
