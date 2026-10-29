import { Redirect } from "expo-router";
import { config } from "@/core/config/env";
import { LayoutGallery } from "@/features/feed/layout-gallery";

/** QA only (development builds, or EXPO_PUBLIC_QA_TOOLS): the feed's cards with made-up posts. */
export default function QaFeedRoute() {
  if (!__DEV__ && !config().qaTools) return <Redirect href="/" />;
  return <LayoutGallery />;
}
