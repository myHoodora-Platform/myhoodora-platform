"use client";

import { Suspense } from "react";
import { PageWithRail } from "@/components/layout/app-shell/right-rail";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { NewsFeed } from "@/features/feed/components/news-feed";

export default function NewsFeedPage() {
  return (
    <PageWithRail>
      <Suspense fallback={<FeedSkeleton />}>
        <NewsFeed />
      </Suspense>
    </PageWithRail>
  );
}
