import { PromptEditorPage } from "@/features/admin/feedback/prompt-editor-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PromptEditorPage id={decodeURIComponent(id)} />;
}
