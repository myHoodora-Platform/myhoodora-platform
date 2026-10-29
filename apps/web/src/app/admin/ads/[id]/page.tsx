import { AdEditorPage } from "@/features/admin/ads/ad-editor-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdEditorPage id={decodeURIComponent(id)} />;
}
