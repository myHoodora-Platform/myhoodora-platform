import React from "react";
import { cn } from "./utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-slate-200/60", className)}
      {...props}
    />
  );
}
