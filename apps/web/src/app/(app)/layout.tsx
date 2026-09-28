import { AppShell } from "@/components/layout/app-shell/app-shell";
import { FeedProvider } from "@/features/feed/feed-context";

/**
 * Signed-in pages render per request, not as prebuilt static pages. They're
 * behind login and client-rendered anyway, and as static pages the Next
 * router caches them without their query string, so a page first opened as
 * /for-sale?filter=free could never navigate back to plain /for-sale (the
 * "All" chips, sidebar links and URL clean-ups silently did nothing).
 */
export const dynamic = "force-dynamic";

/** Signed-in app shell. The (app) route group adds no URL segment. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <AppShell>{children}</AppShell>
    </FeedProvider>
  );
}
