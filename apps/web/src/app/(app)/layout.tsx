import { AppShell } from "@/components/layout/app-shell/app-shell";
import { FeedProvider } from "@/features/feed/feed-context";

/** Signed-in app shell. The (app) route group adds no URL segment. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <AppShell>{children}</AppShell>
    </FeedProvider>
  );
}
