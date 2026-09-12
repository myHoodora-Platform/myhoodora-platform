import React from "react";
import { cn } from "./utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "coral";
type ButtonSize = "sm" | "default" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20",
  coral:
    "bg-brand-coral text-white hover:bg-brand-coral/90 shadow-lg shadow-brand-coral/30",
  outline: "bg-background border border-border text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-primary/5",
  secondary: "bg-background text-primary hover:bg-slate-100 shadow-xl",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-sm rounded-xl",
  default: "px-4 py-3 text-sm rounded-xl",
  lg: "px-8 py-4 text-base rounded-xl",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-bold transition-all border-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "default",
      className,
      loading,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        // Default to "button" so Buttons without an explicit type never accidentally
        // submit a parent <form>. Only type="submit" triggers form submission.
        type={type}
        disabled={disabled || loading}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          loading && "relative select-none pointer-events-none",
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin size-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
