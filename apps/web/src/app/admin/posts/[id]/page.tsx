import { PostDetailPage } from "@/features/admin/content/post-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetailPage id={decodeURIComponent(id)} />;
}
