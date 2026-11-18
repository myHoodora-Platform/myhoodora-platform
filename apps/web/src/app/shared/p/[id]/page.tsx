import type { Metadata } from "next";
import { SharedPostView } from "@/features/shared-post/shared-post-view";
import { getSharedPost, postKindWords, previewLine } from "@/lib/api/public-posts";

/**
 * A shared post, for someone not signed in. The proxy shows this at `/p/<id>` (lib/routes.ts
 * sharedPostRewrite); signed-in neighbours get the app's post page there instead. Never indexed:
 * posts are for neighbours, links are for sharing.
 */
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await getSharedPost(id);
  const base: Metadata = { robots: { index: false, follow: false }, alternates: { canonical: `/p/${id}` } };
  if (res.status !== "ok") {
    return { ...base, title: "A post on myHoodora", description: "Join your neighbours on myHoodora.", openGraph: { title: "A neighbour shared this on myHoodora", description: "Join your neighbours on myHoodora.", url: `/p/${id}` } };
  }
  const p = res.post;
  const title = p.mode === "full" ? `${p.author.kind === "team" ? "myHoodora Hood Team" : "A neighbour"} in ${p.hood.name}` : `${postKindWords(p.category).replace(/^./, (c) => c.toUpperCase())} in ${p.hood.name}`;
  const description = previewLine(p);
  return {
    ...base,
    title: `${title} | myHoodora`,
    description,
    openGraph: { title, description, url: `/p/${id}`, type: "article", siteName: "myHoodora" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const ref = (await searchParams).ref;
  const res = await getSharedPost(id);
  return <SharedPostView postId={id} post={res.status === "ok" ? res.post : null} refCode={typeof ref === "string" ? ref : undefined} />;
}
