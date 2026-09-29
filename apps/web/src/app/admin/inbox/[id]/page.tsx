import { ThreadPage } from "@/features/admin/support/thread-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadPage id={decodeURIComponent(id)} />;
}
