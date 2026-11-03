"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { MascotWordmark } from "@myhoodora/ui/logo";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { RealtimeStatusChip } from "@/components/shared/realtime-status";
import { useUnreadMessages } from "@/features/chat/use-unread-messages";
import { ROUTES } from "@/lib/routes";
import { HeaderIconButton } from "./header-icon-button";
import { UserMenu } from "./user-menu";

export function AppHeader() {
  const unreadMessages = useUnreadMessages();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 lg:h-[72px] lg:px-6">
        <Link href={ROUTES.newsFeed} aria-label="myHoodora home" className="flex shrink-0 items-center lg:w-[232px]">
          <MascotWordmark size="sm" />
        </Link>

        {/* The one search box on desktop (GET /search → /search?q=); phones use the search page's own box. */}
        <Suspense fallback={<div className="hidden flex-1 md:flex" />}>
          <HeaderSearch />
        </Suspense>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <RealtimeStatusChip className="hidden sm:inline-flex" />
          <HeaderIconButton href={ROUTES.search()} icon={Search} label="Search" className="md:hidden" />
          <HeaderIconButton
            href={ROUTES.inbox}
            icon={MessageCircle}
            label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}
            badge={unreadMessages}
          />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Header search. On /search it shows the current query, so there's only ever one box to edit. */
function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === ROUTES.search() ? (params.get("q") ?? "") : "";
  const [query, setQuery] = useState(current);
  useEffect(() => setQuery(current), [current]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (q.length >= 2) router.push(ROUTES.search(q, pathname === ROUTES.search() ? (params.get("type") ?? undefined) : undefined));
      }}
      className="hidden flex-1 justify-center md:flex"
    >
      <label className="flex h-11 w-full max-w-xl items-center gap-3 rounded-full border border-border bg-muted/60 px-4 text-[15px] focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/20">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          aria-label="Search myHoodora"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          placeholder="Search posts, items and neighbours"
          className="h-full w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
    </form>
  );
}
