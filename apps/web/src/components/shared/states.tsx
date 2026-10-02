import type { LucideIcon } from "lucide-react";
import { AlertCircle, FlaskConical, RefreshCw } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { ENDPOINTS, USE_MOCKS, type EndpointKey } from "@/lib/api/config";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** What happened, why it's empty, and what to do next. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-destructive/20 bg-danger-soft/40 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Shown on screens backed by an endpoint the API doesn't have yet, so
 * testers know actions here are saved on this device only.
 */
export function PreviewNotice({ endpoint, className }: { endpoint: EndpointKey; className?: string }) {
  if (!USE_MOCKS && ENDPOINTS[endpoint] === "live") return null;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl bg-info-soft/60 px-3 py-2 text-xs font-medium text-info",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Preview: this feature is still being connected, so what you do here is saved on this device only.
    </p>
  );
}
