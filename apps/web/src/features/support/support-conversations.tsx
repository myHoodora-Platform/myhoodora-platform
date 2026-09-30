"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import { SUPPORT_REPLY_TIME, SupportForm } from "@/features/help/support-form";
import { errorMessage } from "@/lib/api/client";
import { listSupportThreads, type SupportThreadSummary } from "@/lib/api/support";
import { useLiveVersion } from "@/lib/realtime/use-realtime";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import { SupportAvatar, SupportName, SupportStatusChip } from "./support-identity";

/** Your conversations with the team (the pane behind the pinned row in Messages). */
export function SupportConversations() {
  const { user } = useAuth();
  const router = useRouter();
  const version = useLiveVersion(["support.message", "unread.changed"], { mockPrefix: "support-threads" });
  const [threads, setThreads] = useState<SupportThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listSupportThreads(user)
      .then((t) => {
        if (!alive) return;
        setThreads(t);
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, "Couldn't load your conversations.")));
    return () => {
      alive = false;
    };
  }, [user, version]);

  const showForm = composing || threads?.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link href={ROUTES.inbox} aria-label="Back to messages" className="flex size-10 items-center justify-center rounded-full hover:bg-muted lg:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        <SupportAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            <SupportName />
          </p>
          <p className="truncate text-xs text-muted-foreground">Help with your account, verification or safety</p>
        </div>
        {threads && threads.length > 0 && (
          <Button size="sm" variant={composing ? "outline" : "default"} onClick={() => setComposing((c) => !c)}>
            {composing ? <X className="size-4" /> : <MessageSquarePlus className="size-4" />}
            {composing ? "Cancel" : "New message"}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden /> Real people reply here, {SUPPORT_REPLY_TIME}. If anyone is in danger, call 112 first.
        </p>

        {showForm && (
          <div className="border-b border-border">
            <p className="px-4 pt-4 text-sm font-bold">{threads?.length === 0 ? "How can we help?" : "New message"}</p>
            <SupportForm onSent={(id) => router.push(ROUTES.supportThread(id))} />
          </div>
        )}

        {error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : threads === null ? (
          <div className="space-y-2 p-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          threads.length > 0 && (
            <ul className="space-y-1 p-2" aria-label="Your conversations">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={ROUTES.supportThread(t.id)} className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-[15px]", t.unread ? "font-bold" : "font-semibold")}>{t.subject}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.updatedAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <SupportStatusChip status={t.status} />
                        {t.lastMessage && (
                          <p className={cn("truncate text-sm", t.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {t.lastMessage.from === "user" ? "You: " : ""}
                            {t.lastMessage.body}
                          </p>
                        )}
                      </div>
                    </div>
                    {t.unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand-coral" aria-label="Unread reply" />}
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
