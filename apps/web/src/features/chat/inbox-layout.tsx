import { cn } from "@myhoodora/ui/utils";
import { PreviewNotice } from "@/components/shared/states";
import { ConversationList } from "./conversation-list";

/**
 * Two panes on desktop (list | thread). On phones only one pane shows:
 * the list at /inbox, the thread at /inbox/[id].
 */
export function InboxLayout({ activeId, children }: { activeId?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-10rem-var(--banners-h,0px)-env(safe-area-inset-bottom))] min-h-[24rem] overflow-hidden rounded-2xl border border-border bg-card sm:h-[calc(100dvh-10.5rem-var(--banners-h,0px)-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-72px-3rem-var(--banners-h,0px))]">
      <div className={cn("w-full shrink-0 flex-col border-border lg:flex lg:w-80 lg:border-r", activeId ? "hidden" : "flex")}>
        <div className="border-b border-border p-4">
          <h1 className="text-xl font-bold tracking-tight">Messages</h1>
        </div>
        <div className="px-3 pt-3">
          <PreviewNotice endpoint="chat" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList activeId={activeId} />
        </div>
      </div>
      <div className={cn("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden lg:flex")}>{children}</div>
    </div>
  );
}
