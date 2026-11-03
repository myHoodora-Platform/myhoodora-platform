import type { Metadata } from "next";
import { PageWithRail } from "@/components/layout/app-shell/right-rail";
import { PostPage } from "@/features/post/post-page";

/**
 * Generic preview until a public GET /posts/:id exists — then this fetches
 * the post server-side and returns its text + image as OpenGraph metadata so
 * links shared on WhatsApp show the actual post (docs/api-contract.md).
 */
export const metadata: Metadata = {
  title: "Post from your neighbourhood | myHoodora",
  description: "See what your neighbours are sharing on myHoodora.",
  openGraph: {
    title: "A neighbour shared this on myHoodora",
    description: "Join your neighbours on myHoodora to see the post and reply.",
    type: "article",
  },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageWithRail>
      <PostPage postId={id} />
    </PageWithRail>
  );
}
