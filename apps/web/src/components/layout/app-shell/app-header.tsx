"use client";

import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { MascotMark, MascotWordmark } from "@myhoodora/ui/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@myhoodora/ui/tooltip";
import { NotificationBell } from "@/features/notifications/notification-bell";
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
          <span className="sm:hidden">
            <MascotMark size="sm" />
          </span>
          <span className="hidden sm:inline">
            <MascotWordmark size="sm" />
          </span>
        </Link>

        {/* Search — planned (GET /search). Shown so the layout is final; disabled until the endpoint exists. */}
        <div className="hidden flex-1 justify-center md:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                aria-disabled
                className="flex h-11 w-full max-w-xl cursor-not-allowed items-center gap-3 rounded-full border border-border bg-muted/60 px-4 text-[15px] text-muted-foreground"
              >
                <Search className="size-5" aria-hidden />
                Search myHoodora
              </div>
            </TooltipTrigger>
            <TooltipContent>Search is coming soon</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-2">
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
