import React from "react";
import { cn } from "./utils";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
}

/**
 * Full-width page section with the app's standard horizontal padding and a
 * max-w-7xl content container. Pass vertical padding / background via
 * `className` (e.g. "py-24 bg-muted/30").
 */
export function Section({ className, children, ...props }: SectionProps) {
  return (
    <section className={cn("px-6 lg:px-20", className)} {...props}>
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </section>
  );
}

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
}

/** Kicker pill + title + optional description, used at the top of sections. */
export function SectionHeading({
  kicker,
  title,
  description,
  align = "center",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "space-y-4",
        align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...props}
    >
      {kicker && (
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          {kicker}
        </span>
      )}
      <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-base leading-relaxed text-muted-foreground sm:text-lg",
            align === "center" && "mx-auto max-w-2xl",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
