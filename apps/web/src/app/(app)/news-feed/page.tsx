"use client";

import { Suspense } from "react";
import { PageWithRail } from "@/components/layout/app-shell/right-rail";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { NewsFeed } from "@/features/feed/components/news-feed";
import { useRequireOnboarded } from "@/hooks/use-require-onboarded";

export default function NewsFeedPage() {
  useRequireOnboarded();
  return (
    <PageWithRail>
      <Suspense fallback={<FeedSkeleton />}>
        <NewsFeed />
      </Suspense>
    </PageWithRail>
  );
}
