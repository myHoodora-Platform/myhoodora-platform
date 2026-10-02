import { NeighbourDetailPage } from "@/features/admin/community/neighbour-detail-page";

export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <NeighbourDetailPage uid={decodeURIComponent(uid)} />;
}
