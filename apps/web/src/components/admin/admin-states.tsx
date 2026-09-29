"use client";

import Link from "next/link";
import { ArrowLeft, Lock, SearchX } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ProblemState } from "@/components/shared/connection-states";
import { errorKind, errorMessage } from "@/lib/api/client";

/** Maps an API error to the right admin state: 403, 404 or a retryable problem. */
export function AdminProblem({ error, onRetry, backHref }: { error: unknown; onRetry: () => void; backHref?: string }) {
  const kind = errorKind(error);
  if (kind === "forbidden") return <Unauthorized />;
  if (kind === "not_found") return <NotFound backHref={backHref} message={errorMessage(error)} />;
  return <ProblemState title="Couldn't load this" message={errorMessage(error, "Please try again.")} kind={kind} onRetry={onRetry} />;
}

export function Unauthorized({ message = "Your role doesn't include this area. Ask an admin if you need access." }: { message?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-7" aria-hidden />
      </span>
      <p className="text-base font-bold">You don&apos;t have access to this</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Link href="/admin" className="text-sm font-semibold text-primary hover:underline">
        Back to overview
      </Link>
    </div>
  );
}

export function NotFound({ backHref = "/admin", message }: { backHref?: string; message?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden />
      </span>
      <p className="text-base font-bold">{message ?? "We couldn't find that"}</p>
      <p className="max-w-sm text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Go back
      </Link>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

/** Empty state body used inside tables: what's empty and what to do next. */
export function EmptyBody({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <p className="font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
