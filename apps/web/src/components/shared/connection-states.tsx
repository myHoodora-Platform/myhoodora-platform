"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Clock,
  CloudOff,
  LogIn,
  RefreshCw,
  ServerCrash,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import type { ApiErrorKind } from "@/lib/api/client";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";

const KIND_COPY: Partial<Record<ApiErrorKind, { icon: LucideIcon; title: string }>> = {
  offline: { icon: WifiOff, title: "You're offline" },
  timeout: { icon: Clock, title: "Your connection is slow" },
  network: { icon: CloudOff, title: "Can't reach myHoodora" },
  server: { icon: ServerCrash, title: "Something went wrong on our side" },
  auth: { icon: LogIn, title: "Your session has expired" },
};

interface ProblemStateProps {
  /** Fallback title for errors that aren't connection-related. */
  title: string;
  message: string;
  kind: ApiErrorKind | null;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Full-area error for when there's nothing to show. Says what kind of problem
 * it is (offline / slow / server / session) and offers the fix that helps.
 */
export function ProblemState({ title, message, kind, onRetry, retrying, className }: ProblemStateProps) {
  const router = useRouter();
  const copy = kind ? KIND_COPY[kind] : undefined;
  const Icon = copy?.icon ?? AlertCircle;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{copy?.title ?? title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {kind === "auth" ? (
        <Button size="sm" onClick={() => router.push(ROUTES.login)}>
          <LogIn className="size-4" /> Log in again
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      )}
    </div>
  );
}

interface StaleNoticeProps {
  kind: ApiErrorKind | null;
  since: string | null;
  onRetry: () => void;
  retrying?: boolean;
}

/** Inline notice above content that's still shown but couldn't be refreshed. */
export function StaleNotice({ kind, since, onRetry, retrying }: StaleNoticeProps) {
  const reason =
    kind === "offline" ? "You're offline." : kind === "timeout" ? "Your connection is slow." : "Couldn't refresh.";
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm"
    >
      <WifiOff className="size-4 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1 text-foreground/85">
        <span className="font-semibold">{reason}</span>{" "}
        {since ? `Showing posts from ${timeAgo(since)}.` : "Showing the posts you already loaded."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-warning hover:bg-warning/10 disabled:opacity-60"
      >
        <RefreshCw className={cn("size-3.5", retrying && "animate-spin")} aria-hidden />
        Retry
      </button>
    </div>
  );
}

/** Inline retry row for a failed "load more". */
export function InlineRetry({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-3 text-center text-sm">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
        <RefreshCw className="size-4" /> Retry
      </Button>
    </div>
  );
}

/**
 * App-wide strip when the device goes offline, and a "back online" toast
 * when it returns (the feed refetches itself on reconnect).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("You're back online.", { id: "connection", duration: 2500 });
    }
  }, [online]);

  if (online) return null;
  return (
    <div role="status" className="bg-foreground text-background">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-2 text-sm lg:px-6">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">You&apos;re offline.</span> You can still read what&apos;s loaded; posting
          and messaging will work again when you reconnect.
        </span>
      </div>
    </div>
  );
}
