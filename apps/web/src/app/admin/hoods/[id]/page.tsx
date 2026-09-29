import { HoodDetailPage } from "@/features/admin/community/hood-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HoodDetailPage id={decodeURIComponent(id)} />;
}
