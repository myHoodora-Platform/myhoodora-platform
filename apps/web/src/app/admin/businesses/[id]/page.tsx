import { BusinessDetailPage } from "@/features/admin/businesses/business-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessDetailPage id={decodeURIComponent(id)} />;
}
