import { Suspense } from "react";
import { PostsPage } from "@/features/admin/content/posts-page";

export default function Page() {
  return (
    <Suspense>
      <PostsPage />
    </Suspense>
  );
}
